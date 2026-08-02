import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.AttachingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.ClassPrepareRequest;
import com.sun.jdi.request.StepRequest;
import com.sun.net.httpserver.BasicAuthenticator;
import com.sun.net.httpserver.HttpContext;
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
 * Locally it binds 127.0.0.1. Listening publicly needs VIZ_USER/VIZ_PASS (basic auth)
 * or VIZ_PUBLIC=1 (open, with the source filter and resource caps as the only defence).
 */
public class Visualizer {

    private static final int MAX_STEPS = 4000;
    private static final long TIMEOUT_MS = 15_000;
    private static final int MAX_ARRAY = 200;
    private static final int MAX_DEPTH = 10;
    private static final int MAX_SOURCE = 20_000;          // bytes of submitted code
    private static final int RATE_PER_MINUTE = 60;         // traces per client IP
    private static final int MAX_CONCURRENT = 2;           // child JVMs at once

    /**
     * Submitted code is compiled and run, so anything that reaches outside the
     * algorithm itself is refused before javac sees it. A textual gate is not a
     * sandbox — it is the cheapest layer, under the resource caps and whatever
     * isolation the host provides.
     */
    private static final Map<String, String> FORBIDDEN = new LinkedHashMap<>();
    static {
        FORBIDDEN.put("\\\\u", "unicode escapes (javac decodes them before parsing, so they hide names)");
        FORBIDDEN.put("\\bRuntime\\b", "Runtime");
        FORBIDDEN.put("\\bProcessBuilder\\b", "ProcessBuilder");
        FORBIDDEN.put("System\\s*\\.\\s*(exit|getenv|load|loadLibrary|setProperty|setSecurityManager|inheritedChannel)",
                      "System.exit / System.getenv / System.load");
        FORBIDDEN.put("\\bjava\\s*\\.\\s*(io|net|nio|lang\\s*\\.\\s*reflect|lang\\s*\\.\\s*invoke)\\b",
                      "java.io / java.net / java.nio / reflection");
        FORBIDDEN.put("\\b(File|FileReader|FileWriter|FileInputStream|FileOutputStream|RandomAccessFile|Files|Paths|Path)\\s*[.(<\\[]",
                      "file access");
        FORBIDDEN.put("\\b(Socket|ServerSocket|URL|URI|HttpClient|InetAddress|DatagramSocket)\\b", "network access");
        FORBIDDEN.put("\\bClass\\s*\\.\\s*forName\\b", "Class.forName");
        FORBIDDEN.put("\\.\\s*(getDeclaredMethod|getDeclaredField|getDeclaredConstructor|getMethod|getField|newInstance|setAccessible)\\s*\\(",
                      "reflection");
        FORBIDDEN.put("\\b(MethodHandles|Unsafe|VarHandle)\\b", "low-level handles");
        FORBIDDEN.put("\\b(sun|jdk|javax\\s*\\.\\s*script|javax\\s*\\.\\s*tools)\\s*\\.", "internal / scripting APIs");
        FORBIDDEN.put("\\bnative\\b", "native methods");
    }

    /** Null when the code is acceptable, otherwise the reason to show the user. */
    static String rejectReason(String code) {
        if (code.length() > MAX_SOURCE) {
            return "Code quá dài (giới hạn " + MAX_SOURCE + " ký tự) / source too long";
        }
        for (Map.Entry<String, String> rule : FORBIDDEN.entrySet()) {
            if (java.util.regex.Pattern.compile(rule.getKey()).matcher(code).find()) {
                return "Không cho phép " + rule.getValue()
                        + " — bản public chỉ chạy thuật toán thuần / not allowed on the public build";
            }
        }
        return null;
    }

    // client IP -> timestamps of recent traces, for a crude per-IP rate limit
    private static final Map<String, List<Long>> RECENT = new LinkedHashMap<>();
    private static final java.util.concurrent.Semaphore SLOTS =
            new java.util.concurrent.Semaphore(MAX_CONCURRENT);

    private static synchronized boolean rateLimited(String ip) {
        long now = System.currentTimeMillis();
        List<Long> hits = RECENT.computeIfAbsent(ip, k -> new ArrayList<>());
        hits.removeIf(t -> now - t > 60_000);
        if (RECENT.size() > 5000) {
            RECENT.clear();                                // keep the map bounded
        }
        if (hits.size() >= RATE_PER_MINUTE) {
            return true;
        }
        hits.add(now);
        return false;
    }

    public static void main(String[] argv) throws Exception {
        if (argv.length > 0 && argv[0].equals("--selftest")) {
            selfTest();
            return;
        }
        // PORT is what Render/Koyeb/Cloud Run inject; a container must bind 0.0.0.0
        String env = System.getenv("PORT");
        int port = argv.length > 0 ? Integer.parseInt(argv[0])
                 : env != null ? Integer.parseInt(env) : 8088;
        boolean hosted = env != null;
        String host = System.getenv().getOrDefault("VIZ_HOST", hosted ? "0.0.0.0" : "127.0.0.1");

        HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
        HttpContext ui = server.createContext("/", Visualizer::serveIndex);
        HttpContext api = server.createContext("/api/trace", Visualizer::serveTrace);
        // A platform health check cannot authenticate, so this one route stays open;
        // it reveals nothing and runs no code.
        server.createContext("/healthz", ex -> send(ex, 200, "text/plain", "ok"));

        // This endpoint compiles and runs whatever it is sent, so a reachable
        // instance must be behind a password. Refuse to open up without one.
        String user = System.getenv("VIZ_USER"), pass = System.getenv("VIZ_PASS");
        if (user != null && pass != null && !pass.isBlank()) {
            BasicAuthenticator gate = new BasicAuthenticator("java-viz") {
                @Override
                public boolean checkCredentials(String u, String p) {
                    return user.equals(u) && pass.equals(p);
                }
            };
            ui.setAuthenticator(gate);
            api.setAuthenticator(gate);
        } else if ("1".equals(System.getenv("VIZ_PUBLIC"))) {
            System.out.println("VIZ_PUBLIC=1: open to everyone. Submitted code is filtered and"
                    + " capped, which is not a sandbox — keep no secrets in this environment.");
        } else if (!host.equals("127.0.0.1") && !host.equals("localhost")) {
            System.err.println("Refusing to listen on " + host + " without VIZ_USER/VIZ_PASS"
                    + " (or VIZ_PUBLIC=1 to accept the risk):"
                    + " this server executes arbitrary submitted Java.");
            return;
        }

        server.setExecutor(Executors.newFixedThreadPool(2));
        server.start();
        String mode = (user != null && pass != null && !pass.isBlank()) ? "basic auth"
                    : "1".equals(System.getenv("VIZ_PUBLIC")) ? "public, no auth"
                    : "loopback only";
        System.out.println("Algorithm visualizer on " + host + ":" + port + " (" + mode + ")");
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
        String ip = ex.getRequestHeaders().getFirst("X-Forwarded-For");
        if (ip == null) {
            ip = ex.getRemoteAddress().getAddress().getHostAddress();
        }
        ip = ip.split(",")[0].trim();
        // loopback is the developer and the audit script; the limit is for the internet
        boolean local = ip.equals("127.0.0.1") || ip.equals("::1") || ip.equals("0:0:0:0:0:0:0:1");
        if (!local && rateLimited(ip)) {
            send(ex, 429, "application/json; charset=utf-8",
                 "{\"ok\":false,\"error\":" + q("Quá nhiều lượt chạy, thử lại sau một phút / rate limited") + "}");
            return;
        }
        String code = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String refuse = rejectReason(code);
        if (refuse != null) {
            send(ex, 200, "application/json; charset=utf-8",
                 "{\"ok\":false,\"error\":" + q(refuse) + "}");
            return;
        }
        String json;
        if (!SLOTS.tryAcquire()) {
            send(ex, 503, "application/json; charset=utf-8",
                 "{\"ok\":false,\"error\":" + q("Server đang bận, thử lại / busy") + "}");
            return;
        }
        try {
            json = run(code);
        } catch (Exception e) {
            json = "{\"ok\":false,\"error\":" + q(e.toString()) + "}";
        } finally {
            SLOTS.release();
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

    /**
     * Starts the traced JVM ourselves and attaches over a socket, rather than
     * letting JDI's CommandLineLaunch do both.
     *
     * The launching connector reads the child's first output expecting a JDWP
     * handshake, so anything the JVM prints first — an inherited
     * JAVA_TOOL_OPTIONS notice, a heap it cannot reserve — surfaces as
     * "handshake failed - unrecognized message from target VM" with the real
     * reason thrown away. Doing it by hand lets us clear the child's
     * environment (which also stops submitted code from reading ours), capture
     * what it actually said, and report that instead.
     */
    private static String trace(Path classDir) throws Exception {
        String javaBin = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        ProcessBuilder pb = new ProcessBuilder(javaBin,
                "-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=127.0.0.1:0",
                "-ea", "-Xmx96m", "-Xss1m", "-XX:ActiveProcessorCount=1",
                "-XX:-UsePerfData", "-XX:TieredStopAtLevel=1",
                "-cp", classDir.toString(), "Main");
        pb.environment().clear();                 // no host env reaches the traced code
        Process child = pb.start();

        StringBuilder stdout = new StringBuilder();
        // jdwp announces its port on the first stdout line, before it suspends
        java.io.BufferedReader head = new java.io.BufferedReader(
                new java.io.InputStreamReader(child.getInputStream(), StandardCharsets.UTF_8));
        int debugPort = -1;
        String line;
        while ((line = head.readLine()) != null) {
            java.util.regex.Matcher m =
                    java.util.regex.Pattern.compile("address:\\s*(\\d+)").matcher(line);
            if (m.find()) {
                debugPort = Integer.parseInt(m.group(1));
                break;
            }
            stdout.append(line).append('\n');
        }
        if (debugPort < 0) {
            child.destroyForcibly();
            drain(child.getErrorStream(), stdout);
            child.waitFor();
            return "{\"ok\":false,\"error\":" + q("JVM con không khởi động được / traced JVM failed to start:\n"
                    + stdout.toString().trim()) + "}";
        }

        VirtualMachine vm = attach(debugPort, child, stdout);
        if (vm == null) {
            return "{\"ok\":false,\"error\":" + q("Không attach được vào JVM con / could not attach:\n"
                    + stdout.toString().trim()) + "}";
        }
        drainReader(head, stdout);
        drain(child.getErrorStream(), stdout);

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
        child.destroyForcibly();          // the step loop may have exited early
        child.waitFor();

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

    /** The child suspends until someone attaches; give it a few tries. */
    private static VirtualMachine attach(int port, Process child, StringBuilder log) {
        AttachingConnector connector = Bootstrap.virtualMachineManager().attachingConnectors()
                .stream().filter(c -> c.name().equals("com.sun.jdi.SocketAttach"))
                .findFirst().orElse(null);
        if (connector == null) {
            log.append("no SocketAttach connector in this JDK\n");
            return null;
        }
        Map<String, Connector.Argument> args = connector.defaultArguments();
        args.get("hostname").setValue("127.0.0.1");
        args.get("port").setValue(String.valueOf(port));
        for (int attempt = 0; attempt < 20; attempt++) {
            try {
                return connector.attach(args);
            } catch (Exception e) {
                if (!child.isAlive()) {
                    log.append(e).append('\n');
                    return null;
                }
                try {
                    Thread.sleep(100);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                    return null;
                }
            }
        }
        log.append("attach timed out after 2s\n");
        child.destroyForcibly();
        return null;
    }

    private static void drainReader(java.io.BufferedReader reader, StringBuilder sink) {
        Thread.ofVirtual().start(() -> {
            try (reader) {
                String line;
                while ((line = reader.readLine()) != null) {
                    synchronized (sink) {
                        sink.append(line).append('\n');
                    }
                }
            } catch (IOException ignored) {
                // child JVM exited
            }
        });
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
