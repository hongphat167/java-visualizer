// Loads the real decision layer out of index.html (with a DOM stub) and checks
// every algorithm: declared view honoured, data present at every step, no throw.
const fs = require("fs");
const DIR = __dirname;

const stub = new Proxy({}, {
  get(_, k) {
    if (k === "children" || k === "childNodes") return [];
    if (k === "style" || k === "dataset") return {};
    if (k === "classList") return { toggle() {}, add() {}, remove() {}, contains: () => false };
    if (k === "textContent" || k === "innerHTML" || k === "value" || k === "max") return "";
    if (k === Symbol.iterator) return [][Symbol.iterator].bind([]);
    return typeof k === "string" ? () => stub : undefined;
  },
  set: () => true,
});
global.document = {
  getElementById: () => stub, createElement: () => stub, createElementNS: () => stub,
  querySelector: () => null, querySelectorAll: () => [], documentElement: { style: { setProperty() {} } },
  addEventListener() {},
};
global.location = { hash: "" };
global.addEventListener = () => {};
global.matchMedia = () => ({ matches: false });
const realFetch = global.fetch;   // the page's own build() must not call out
global.fetch = () => Promise.reject(new Error("offline"));
global.window = global;

const presets = fs.readFileSync(DIR + "/presets.js", "utf8").replace(/^const /gm, "globalThis.");
(0, eval)(presets);

// The page starts its own timers on load, which would keep this process alive —
// and fetch needs the real ones back, so only the load is stubbed.
const realTimers = { setInterval, setTimeout, clearInterval, clearTimeout };
global.setInterval = () => 0;
global.setTimeout = () => 0;

const html = fs.readFileSync(DIR + "/index.html", "utf8");
const body = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
(0, eval)(body + `
;globalThis.__api = {
  prep(a, st) {
    algo = a; steps = st; carried = null;
    constant = findConstant(st); roles = findRoles(st);
    graphVars = findGraphVars(st); treeVars = findTreeVars(st); forestVars = findForestVars(st);
    figureSpec = resolveFigure(st);
    return figureSpec;
  },
  data(step) { return figureData(step); },
  // figureData says the numbers are there; it cannot say the figure can be built
  // from them. These three builders are pure, so they run here — drawFigure itself
  // needs a real DOM and only produces noise against the stub.
  build(step) {
    const d = figureData(step);
    if (!d) return;
    if (figureSpec.kind === "graph") matrixGraph(d, subLabels(step, d.length));
    else if (figureSpec.kind === "forest") parentForest(d, nodeLabels(step, d.length), allocated(step));
    else if (figureSpec.kind === "tree" && Array.isArray(d)) arrayTree(d);
  },
  note(prev, step) { return describe(prev, step); },
  // What the input box would send: readArray needs the algorithm selected,
  // because that is how an opted-out one reports no editable array.
  editable(a) { algo = a; return readArray(CODE[a]); },
  retype(a, values) {
    return CODE[a].replace(ARRAY_LITERAL, m => m.replace(/\\{[^{}]*\\}/, "{" + values.join(", ") + "}"));
  },
};`);

Object.assign(global, realTimers);

(async () => {
  let problems = 0, checked = 0;
  for (const [group, items] of Object.entries(PRESETS)) {
    for (const [name, code] of Object.entries(items)) {
      const res = await realFetch("http://127.0.0.1:8088/api/trace", { method: "POST", body: code });
      const trace = await res.json();
      if (!trace.ok) { console.log("TRACE-FAIL", name); problems++; continue; }
      checked++;

      const declared = VIEW[name];
      const want = typeof declared === "string" ? declared : declared.kind;
      let spec, kinds = new Set(), empty = 0, threw = null;
      try {
        spec = __api.prep(name, trace.steps);
        for (let i = 0; i < trace.steps.length; i++) {
          const d = __api.data(trace.steps[i]);
          kinds.add(spec ? spec.kind : "none");
          const len = d && d.items ? d.items.length : Array.isArray(d) ? d.length : d === null ? 0 : 1;
        if (!len) empty++;
          __api.note(i ? trace.steps[i - 1] : null, trace.steps[i]);
          __api.build(trace.steps[i]);
        }
      } catch (e) { threw = e; }

      const got = spec ? spec.kind : "none";
      const norm = got === "rows" ? "table" : got;
      const flags = [];
      if (threw) flags.push("THREW " + threw.message);
      if (want === "none" ? got !== "none" : norm !== want)
        flags.push(`view ${got} != declared ${want}`);
      if (kinds.size > 1) flags.push("view changed mid-run: " + [...kinds].join("/"));
      if (want !== "none" && empty > trace.steps.length * 0.5)
        flags.push(`empty ${empty}/${trace.steps.length} steps`);

      // The randomise button rewrites the first int[] literal in the source. When
      // that literal is the algorithm's own state instead of its input, the run
      // comes back wrong or never terminates, so trace that path too.
      const editable = __api.editable(name);
      if (editable.length) {
        const swapped = editable.map((_, i) => 1 + (i * 7 + 3) % 20);
        const res2 = await realFetch("http://127.0.0.1:8088/api/trace",
                                     { method: "POST", body: __api.retype(name, swapped) });
        const t2 = await res2.json();
        // A crashing program still traces with ok:true — the stack trace only
        // shows up on stdout. Running past the step cap sets truncated instead.
        const boom = /^Exception in thread|^\tat /m.test(t2.stdout || "");
        const label = `edited input {${swapped.join(", ")}}`;
        if (!t2.ok) flags.push(`${label} fails to trace`);
        else if (boom) flags.push(`${label} throws: ${(t2.stdout.match(/^Exception.*/m) || [""])[0]}`);
        else if (t2.truncated && !trace.truncated) flags.push(`${label} runs past the step cap`);
      }

      if (flags.length) { problems++; console.log(`${group} / ${name}\n    ${flags.join("\n    ")}`); }
      else console.log(`ok  ${want.padEnd(7)} ${spec ? String(spec.name).padEnd(8) : "".padEnd(8)} ${name}`);
    }
  }
  console.log(`\n${checked} algorithms checked, ${problems} problems`);
})();
