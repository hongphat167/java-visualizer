import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.StepRequest;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;

/**
 * Java algorithm visualizer backend.
 *
 * Compiles user code to a temp dir, launches it under JDI (the JDK's own debugger API),
 * single-steps every line, and records line number + local variables at each step.
 * The recorded trace is replayed by index.html in the browser.
 *
 * Run:  java Visualizer.java [port]
 * Test: java Visualizer.java --selftest
 *
 * SECURITY: this executes arbitrary user-submitted Java in a child JVM with no sandbox.
 * It binds to 127.0.0.1 only. Do not expose this port to a network.
 */
public class Visualizer {

    private static final int MAX_STEPS = 4000;
    private static final long TIMEOUT_MS = 15_000;
    private static final int MAX_ARRAY = 200;
    private static final int MAX_DEPTH = 10;

    public static void main(String[] argv) throws Exception {
        if (argv.length > 0 && argv[0].equals("--selftest")) {
            selfTest();
            return;
        }
        int port = argv.length > 0 ? Integer.parseInt(argv[0]) : 8088;
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", Visualizer::serveIndex);
        server.createContext("/api/trace", Visualizer::serveTrace);
        server.setExecutor(Executors.newFixedThreadPool(2));
        server.start();
        System.out.println("Algorithm visualizer: http://127.0.0.1:" + port);
    }

    // ---------- HTTP ----------

    /** Serves index.html plus the sibling assets it references. */
    private static void serveIndex(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        String name = path.equals("/") ? "index.html" : path.substring(1);
        // one optional directory level, no traversal, no arbitrary reads
        if (!name.matches("([\\w-]+/)?[\\w.-]+\\.(html|js|css|woff2)")) {
            send(ex, 404, "text/plain", "not found");
            return;
        }
        Path file = Path.of(name).toAbsolutePath();
        if (!Files.exists(file)) {
            send(ex, 404, "text/plain", name + " not found in " + file.getParent());
            return;
        }
        if (name.endsWith(".woff2")) {
            byte[] bytes = Files.readAllBytes(file);
            ex.getResponseHeaders().set("Content-Type", "font/woff2");
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(bytes);
            }
            return;
        }
        String type = name.endsWith(".js") ? "text/javascript"
                : name.endsWith(".css") ? "text/css" : "text/html";
        send(ex, 200, type + "; charset=utf-8", Files.readString(file));
    }

    /** Body is the raw Java source (text/plain). Response is the JSON trace. */
    private static void serveTrace(HttpExchange ex) throws IOException {
        if (!ex.getRequestMethod().equals("POST")) {
            send(ex, 405, "text/plain", "POST only");
            return;
        }
        String code = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String json;
        try {
            json = run(code);
        } catch (Exception e) {
            json = "{\"ok\":false,\"error\":" + q(e.toString()) + "}";
        }
        send(ex, 200, "application/json; charset=utf-8", json);
    }

    private static void send(HttpExchange ex, int status, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", type);
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    // ---------- compile + trace ----------

    static String run(String code) throws Exception {
        Path dir = Files.createTempDirectory("algoviz");
        Path src = dir.resolve("Main.java");
        Files.writeString(src, code);

        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        DiagnosticCollector<JavaFileObject> diags = new DiagnosticCollector<>();
        try (StandardJavaFileManager fm = compiler.getStandardFileManager(diags, null, null)) {
            boolean ok = compiler.getTask(
                    null, fm, diags,
                    List.of("-g", "-d", dir.toString()),
                    null,
                    fm.getJavaFileObjects(src.toFile())
            ).call();
            if (!ok) {
                StringBuilder sb = new StringBuilder();
                diags.getDiagnostics().forEach(d -> sb.append(d.getLineNumber())
                        .append(": ").append(d.getMessage(null)).append('\n'));
                return "{\"ok\":false,\"error\":" + q(sb.toString()) + "}";
            }
        }
        return trace(dir);
    }

    private static String trace(Path classDir) throws Exception {
        LaunchingConnector connector = Bootstrap.virtualMachineManager().defaultConnector();
        Map<String, Connector.Argument> args = connector.defaultArguments();
        args.get("main").setValue("Main");
        args.get("options").setValue("-ea -cp \"" + classDir + "\"");

        VirtualMachine vm = connector.launch(args);
        StringBuilder stdout = new StringBuilder();
        drain(vm.process().getInputStream(), stdout);
        drain(vm.process().getErrorStream(), stdout);

        ClassPrepareRequest prepare = vm.eventRequestManager().createClassPrepareRequest();
        prepare.addClassFilter("Main*");
        prepare.enable();

        List<String> steps = new ArrayList<>();
        boolean truncated = false;
        long deadline = System.currentTimeMillis() + TIMEOUT_MS;

        EventQueue queue = vm.eventQueue();
        loop:
        while (true) {
            EventSet set;
            try {
                set = queue.remove(300);
            } catch (VMDisconnectedException e) {
                break;
            }
            if (set == null) {
                if (System.currentTimeMillis() > deadline) {
                    truncated = true;
                    vm.exit(1);
                    break;
                }
                continue;
            }
            for (Event event : set) {
                if (event instanceof ClassPrepareEvent cpe) {
                    if (vm.eventRequestManager().stepRequests().isEmpty()) {
                        StepRequest step = vm.eventRequestManager()
                                .createStepRequest(cpe.thread(), StepRequest.STEP_LINE, StepRequest.STEP_INTO);
                        for (String p : new String[]{"java.*", "javax.*", "jdk.*", "sun.*", "com.sun.*"}) {
                            step.addClassExclusionFilter(p);
                        }
                        step.enable();
                    }
                } else if (event instanceof StepEvent se) {
                    String snap = snapshot(se);
                    if (snap != null) {
                        steps.add(snap);
                    }
                    if (steps.size() >= MAX_STEPS || System.currentTimeMillis() > deadline) {
                        truncated = true;
                        vm.exit(1);
                        break loop;
                    }
                } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                    break loop;
                }
            }
            try {
                set.resume();
            } catch (VMDisconnectedException e) {
                break;
            }
        }
        vm.process().waitFor();

        return "{\"ok\":true,\"truncated\":" + truncated
                + ",\"stdout\":" + q(stdout.toString())
                + ",\"steps\":[" + String.join(",", steps) + "]}";
    }

    /** One trace entry: current line, call stack, and visible locals of the top frame. */
    private static String snapshot(StepEvent se) {
        try {
            StackFrame frame = se.thread().frame(0);
            Location loc = frame.location();
            if (!loc.declaringType().name().startsWith("Main")) {
                return null;
            }
            // Insertion order decides what the UI draws first, and later puts win.
            Map<String, String> vars = new LinkedHashMap<>();

            // static fields of Main first: algorithms that keep their data in a
            // static array (trees, adjacency, memo tables) have no locals at all
            ReferenceType owner = loc.declaringType();
            for (Field f : owner.fields()) {
                if (f.isStatic() && !f.isSynthetic()) {
                    vars.put(f.name(), json(owner.getValue(f), 0));
                }
            }
            ObjectReference self = frame.thisObject();
            if (self != null) {
                for (Field f : self.referenceType().fields()) {
                    if (!f.isStatic() && !f.isSynthetic()) {
                        vars.put(f.name(), json(self.getValue(f), 0));
                    }
                }
            }
            // Locals of every Main frame, outermost first: while a recursive call
            // is on top, main's tree/array must stay on screen. The innermost
            // frame is written last, so a shadowed name resolves to it.
            List<StackFrame> frames = se.thread().frames();
            for (int i = frames.size() - 1; i >= 0; i--) {
                StackFrame f = frames.get(i);
                if (!f.location().declaringType().name().startsWith("Main")) {
                    continue;
                }
                try {
                    for (LocalVariable lv : f.visibleVariables()) {
                        vars.put(lv.name(), json(f.getValue(lv), 0));
                    }
                } catch (AbsentInformationException ignored) {
                    // compiled without -g on some frame; locals simply unavailable
                }
            }

            StringBuilder body = new StringBuilder();
            for (Map.Entry<String, String> e : vars.entrySet()) {
                if (body.length() > 0) {
                    body.append(',');
                }
                body.append(q(e.getKey())).append(':').append(e.getValue());
            }
            StringBuilder stack = new StringBuilder();
            for (StackFrame f : se.thread().frames()) {
                String name = f.location().declaringType().name();
                if (!name.startsWith("Main")) {
                    continue;
                }
                if (stack.length() > 0) {
                    stack.append(',');
                }
                stack.append(q(f.location().method().name() + ":" + f.location().lineNumber()));
            }
            return "{\"line\":" + loc.lineNumber()
                    + ",\"method\":" + q(loc.method().name())
                    + ",\"stack\":[" + stack + "]"
                    + ",\"vars\":{" + body + "}}";
        } catch (IncompatibleThreadStateException e) {
            return null;
        }
    }

    /** Renders a JDI value as JSON. Depth-limited; no method calls into the target VM. */
    private static String json(Value v, int depth) {
        if (v == null) {
            return "null";
        }
        if (v instanceof StringReference s) {
            return q(s.value());
        }
        if (v instanceof CharValue c) {
            return q(String.valueOf(c.value()));
        }
        if (v instanceof PrimitiveValue) {
            return v.toString();
        }
        if (v instanceof ArrayReference arr) {
            if (depth > MAX_DEPTH) {
                return q("[...]");
            }
            List<Value> values = arr.length() == 0 ? List.of() : arr.getValues(0, Math.min(arr.length(), MAX_ARRAY));
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < values.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(json(values.get(i), depth + 1));
            }
            return sb.append(']').toString();
        }
        if (v instanceof ObjectReference obj) {
            // boxed primitives read as their value at any depth — a Character key
            // should never render as java.lang.Character@42
            String type = obj.referenceType().name();
            if (type.startsWith("java.lang.")) {
                Field value = obj.referenceType().fieldByName("value");
                if (value != null && obj.getValue(value) instanceof PrimitiveValue prim) {
                    return json(prim, depth);
                }
            }
            if (depth > MAX_DEPTH) {   // deep enough to walk a short linked list
                return q(type + "@" + obj.uniqueID());
            }
            StringBuilder sb = new StringBuilder("{\"__type\":").append(q(type));
            // allFields, not fields: StringBuilder keeps value/count on its superclass
            for (Field f : obj.referenceType().allFields()) {
                if (f.isStatic()) {
                    continue;
                }
                sb.append(',').append(q(f.name())).append(':').append(json(obj.getValue(f), depth + 1));
            }
            return sb.append('}').toString();
        }
        return q(v.toString());
    }

    private static void drain(InputStream in, StringBuilder sink) {
        Thread.ofVirtual().start(() -> {
            try (in) {
                byte[] buf = new byte[4096];
                int n;
                while ((n = in.read(buf)) > 0) {
                    synchronized (sink) {
                        sink.append(new String(buf, 0, n, StandardCharsets.UTF_8));
                    }
                }
            } catch (IOException ignored) {
                // child JVM exited
            }
        });
    }

    private static String q(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.append('"').toString();
    }

    // ---------- self check ----------

    private static void selfTest() throws Exception {
        String code = """
                public class Main {
                    public static void main(String[] a) {
                        int[] x = {3, 1, 2};
                        for (int i = 0; i < x.length; i++)
                            for (int j = 0; j < x.length - 1 - i; j++)
                                if (x[j] > x[j + 1]) { int t = x[j]; x[j] = x[j + 1]; x[j + 1] = t; }
                        System.out.println(x[0] + "," + x[1] + "," + x[2]);
                    }
                }
                """;
        String out = run(code);
        assertTrue(out.contains("\"ok\":true"), "compile+trace failed: " + out);
        assertTrue(out.contains("\"line\":"), "no steps recorded");
        assertTrue(out.contains("1,2,3"), "program did not sort; stdout missing from " + out);
        assertTrue(out.contains("\"x\":[1,2,3]"), "final array state never observed in trace");

        String bad = run("public class Main { oops }");
        assertTrue(bad.contains("\"ok\":false"), "compile error not reported: " + bad);

        System.out.println("selftest OK (" + out.split("\"line\":").length + " steps)");
    }

    private static void assertTrue(boolean cond, String msg) {
        if (!cond) {
            throw new AssertionError(msg);
        }
    }
}
