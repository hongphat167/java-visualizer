# JAVA·VIZ — Java Algorithm Visualizer

Paste real Java, watch it run one line at a time: the array, the variables, the
running source line and a plain-language narration all stay in sync.

Unlike most algorithm visualizers, nothing here is pre-scripted. The backend
**compiles your code and single-steps the real JVM** through the JDK's own
debugger interface (JDI), recording the line number and every local variable at
each step. The browser replays that trace.

![stack](https://img.shields.io/badge/java-21-orange) ![deps](https://img.shields.io/badge/dependencies-none-brightgreen)

---

## Quick start

Requires **JDK 21+** on the `PATH`. Nothing else — no Maven, no Gradle, no npm.

```bash
git clone https://github.com/hongphat167/java-visualizer
cd java-visualizer
java Visualizer.java          # serves http://127.0.0.1:8088
```

Open <http://127.0.0.1:8088>, pick an algorithm from the catalog, and press play.

```bash
java Visualizer.java 9000     # listen on a different port
java Visualizer.java --selftest   # compile + trace a bubble sort, assert the result
node audit.js                 # server must be up: checks every algorithm's view
```

`audit.js` loads the page's own decision layer with a DOM stub and traces all 68
algorithms: it fails if a view does not match its declaration in `presets.js`,
changes shape mid-run, has no data, or throws on any step.

> **Security:** this compiles and executes arbitrary user-submitted Java in a
> child JVM with **no sandbox**. Locally it binds to `127.0.0.1` and caps each
> run at 15 seconds / 4000 steps. Anyone who can reach `/api/trace` can run code
> on the host, so the server **refuses to listen on a public interface** unless
> `VIZ_USER` / `VIZ_PASS` are set, and even then treat it as a trusted-users-only
> tool: give the container no egress, a read-only filesystem, and CPU/memory/pid
> limits.

## Deploying

`PORT` switches it into hosted mode: it binds `0.0.0.0` (override with
`VIZ_HOST`) and requires basic-auth credentials.

```bash
docker build -t java-viz .
docker run -p 8080:8080 -e VIZ_USER=demo -e VIZ_PASS=... java-viz
```

`render.yaml` deploys the bundled `Dockerfile` on Render's free plan. Koyeb and
Cloud Run work from the same Dockerfile. Netlify and Vercel functions cannot host
it: there is no JVM, and the tracer needs a full JDK (`javax.tools` plus the
`jdk.jdi` module) and the right to spawn a child JVM.

Pick one of two postures, or the server refuses to listen publicly:

| Env | Who can use it |
| --- | --- |
| `VIZ_USER` + `VIZ_PASS` | basic auth on the UI and the API |
| `VIZ_PUBLIC=1` | everyone — accepts the risk below |

### What a public instance enforces

Submitted code is refused before `javac` sees it if it mentions file access
(`java.io`, `java.nio`, `Files`, `Path`), networking (`java.net`, `Socket`,
`URL`, `HttpClient`), process control (`Runtime`, `ProcessBuilder`,
`System.exit`), the environment (`System.getenv`), reflection
(`Class.forName`, `getDeclaredMethod`, `MethodHandles`, `Unsafe`), internal
packages (`sun.*`, `jdk.*`, `javax.script`), `native` methods, or a `\u` escape
(javac decodes those before parsing, so they would hide any of the above).

On top of that: 20KB of source, a 64MB heap on one CPU, 15 seconds, 4000 steps,
60 traces per minute per IP, two child JVMs at a time.

**This is a filter, not a sandbox.** A determined attacker may still find a way
through, and can always burn CPU. Run a public instance with no secrets in its
environment, nothing else deployed beside it, and no network it can reach that
you care about. On Cloud Run each instance is additionally a gVisor sandbox,
which is a real isolation boundary; Render and Koyeb give you an ordinary
container.

For a public demo with no code execution at all, pre-render the traces and serve
them statically instead.

---

## What you get

**Home** — a catalog of 68 classic algorithms across 13 categories, generated
from `presets.js` (add an entry there and the catalog picks it up automatically).

The view kind is decided **once per run**, not per step, so the figure never
changes shape while you scrub — a temporary local array can't hijack the panel
from the array the algorithm is actually about.

**Visualizer** — five synchronized panels:

| Panel | Shows |
| --- | --- |
| Controls | category tabs, algorithm tabs, an editable input array, an optional target, Run |
| Figure | one view for the whole run — bars, node-link graph, DP table or linear cells |
| Code | the running line highlighted; `✎ SỬA CODE / EDIT` swaps it for a textarea so you can paste your own Java, saved per algorithm |
| What's happening | one sentence per step, in Vietnamese and English |
| Step log · Stack · Output | the last 9 narrations, the call stack, the program's stdout |

Playback: step forward/back, jump to first/last, scrub to any step, play at
0.5× / 1× / 2× / 4×.

### The figure adapts to the data

Which view an algorithm gets is **declared** in `VIEW` (`presets.js`), the way
the design pins `META.kind`: bars belong to the sorts and to linear/binary
search, everything else is a graph, tree, forest, DP table, board, stack, queue
or a row of cells. The table below is how a value is drawn once its view is
known — and the fallback for code you paste yourself.

| Value in scope | Rendered as |
| --- | --- |
| `int[]` / `long[]` | bar chart with value and index labels |
| array of only `0`/`1` (visited, sieve) | flag boxes, set entries filled |
| array that never changes (offset tables) | compact box row, not a chart |
| `int[][]` that is square with a zero diagonal | **node-link graph** — nodes on a circle, weights in boxes on the edges, arrowheads when the matrix is asymmetric |
| any other `int[][]` | heat-mapped matrix |
| `int[] tree` / `heap` (heap-encoded, `-1` = empty) | **binary tree** drawn by depth |
| a node object with `left`/`right` | **binary tree** laid out in-order |
| `int[] parent` (valid indices) | **forest**: one arrow per node to its parent — a parallel char array names the nodes and a `used` counter hides slots not allocated yet, so a trie reads as letters |
| array + a `top` counter, named `stack`/`stk` (or `X` beside `XTop`) | **stack** — only the live cells, growing upwards, the last tagged `top ↑` |
| array + `head`/`tail`, named `queue`/`deque`, or a real `ArrayDeque` | **queue** — live cells left to right, ends tagged `front` / `rear` |
| `String` | character boxes |
| `ArrayList`, `ArrayDeque` | contents in real order (the deque's circular buffer is unwrapped) |
| linked-list nodes (`next` + `val`/`value`/`data`) | **node → arrow → … → dashed `null`**: head filled, every `Node`-typed local tagged on the node it points at, and `…` instead of `null` when the chain is cyclic or hit the depth cap |
| `HashMap`, `LinkedHashMap` | `key → value` entries, walked out of the bucket table |
| `StringBuilder` | the text it currently holds |
| plain numbers | a chip plus a sparkline of every value it has held so far |

A graph picks up per-node labels automatically: if a parallel array named
`dist`, `visited`, `done`, `order`, `indegree`… has the same length as the node
count, its values hang under the nodes (`999` and negatives render as `∞`).

### Pointer tracking

Locals with index-like names (`i`, `j`, `mid`, `lo`, `hi`, `left`, `right`,
`head`, `tail`, …) are drawn as colored chips that **slide** to their position as
they move. Pairs like `lo`/`hi` or `left`/`right` dim everything outside the live
window, so binary search and sliding window read at a glance. A pointer is only
attached to the array the running line actually indexes.

### Narration

Each step's sentence is derived from the diff between two snapshots — no
per-algorithm configuration. The UI prints each one in Vietnamese and English;
the English half reads:

```
swap a[2] ↔ a[3]
exp: 1 → 0
queue[4] = 4 (was 0)
declare tmp = 9
Call mergeSort()
Return from fib()
```

---

## Writing your own code

The only requirements: a class named `Main` with a `main` method.

```java
public class Main {
    public static void main(String[] args) {
        int[] a = {5, 2, 9, 1};
        for (int i = 0; i < a.length - 1; i++)
            for (int j = 0; j < a.length - 1 - i; j++)
                if (a[j] > a[j + 1]) {
                    int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;
                }
        System.out.println(java.util.Arrays.toString(a));
    }
}
```

Assertions are enabled (`-ea`), so `assert` statements in your code really fire.

**Keep inputs small.** Every executed line becomes a step: an 8-element sort is
~110 steps and reads beautifully; a 20-element sort blows past the 4000-step cap.

---

## How it works

```
browser ──POST /api/trace (raw Java)──▶ Visualizer.java
                                          │
                                          ├─ javax.tools.JavaCompiler   → Main.class in a temp dir
                                          ├─ com.sun.jdi                → launch a child JVM, suspended
                                          ├─ StepRequest(STEP_LINE)     → step every line of Main*
                                          └─ per step: line, call stack, all visible locals
                                          │
        JSON trace ◀──────────────────────┘
        {"steps":[{"line":6,"method":"main","stack":[…],"vars":{"a":[5,2,9,1],"i":0}}, …]}
```

The frontend keeps one DOM node per array element across steps and only mutates
attributes, so CSS transitions animate the change instead of the browser
rebuilding the view.

### Files

```
Visualizer.java   HTTP server + compiler + JDI tracer (single file, stdlib only)
index.html        home page, visualizer UI, renderers
presets.js        the 68 algorithms, grouped by category, plus their view/complexity tables
fonts.css fonts/  self-hosted JetBrains Mono + Space Grotesk (no CDN calls)
```

### Adding an algorithm

Add it to the right group in `presets.js`:

```js
"Sorting": {
  "Gnome sort": `public class Main {
      public static void main(String[] args) { /* … */ }
  }`,
}
```

It appears in the catalog, the dropdown, and at `#Gnome sort` with no other
changes.

### Deep links

`#<algorithm>` opens it and plays. `#<algorithm>@<step>` opens it paused on that
step — handy for pointing someone at the exact moment something happens:

```
http://127.0.0.1:8088/#Union-Find (DSU)@50
```

---

## Limits

- **Pointer detection is name-based.** A cursor called `cursor` is missed; a
  value variable named `i` is mislabelled as an index. Inferring it from
  bytecode array access would fix this.
- **Depth cap.** Object graphs are serialized 10 levels deep — long `HashMap`
  bucket chains, treeified buckets and long linked lists truncate past that.
- **Step cap.** 4000 steps or 15 seconds per run, whichever comes first; the
  status line reports a truncated run.
- **One class.** Your code must fit in a single `Main.java`.
- **Stack/queue recognition is conventional too.** The backing array is only
  sliced to its live part when the bounding counters are found by name
  (`top`, `<name>Top`, `head`/`tail`); otherwise the whole array is drawn.
- **Tree/forest detection is conventional.** A heap-encoded tree must be called
  `tree`/`heap`/`bst` and a disjoint set `parent`/`par`/`leader`; rename them and
  they fall back to a box row. Adjacency matrices are detected structurally
  (square, zero diagonal), so no naming rule applies there.

## License

Code: see `LICENSE`. The bundled fonts (JetBrains Mono, Space Grotesk) ship
under the SIL Open Font License.
