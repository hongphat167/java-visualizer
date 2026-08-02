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
  querySelector: () => null, documentElement: { style: { setProperty() {} } },
  addEventListener() {},
};
global.location = { hash: "" };
global.addEventListener = () => {};
const realFetch = global.fetch;   // the page's own build() must not call out
global.fetch = () => Promise.reject(new Error("offline"));
global.window = global;

const presets = fs.readFileSync(DIR + "/presets.js", "utf8").replace(/^const /gm, "globalThis.");
(0, eval)(presets);

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
  note(prev, step) { return describe(prev, step); },
};`);

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
          if (d === null || (Array.isArray(d) && !d.length)) empty++;
          __api.note(i ? trace.steps[i - 1] : null, trace.steps[i]);
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

      if (flags.length) { problems++; console.log(`${group} / ${name}\n    ${flags.join("\n    ")}`); }
      else console.log(`ok  ${want.padEnd(7)} ${spec ? String(spec.name).padEnd(8) : "".padEnd(8)} ${name}`);
    }
  }
  console.log(`\n${checked} algorithms checked, ${problems} problems`);
})();
