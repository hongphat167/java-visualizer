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
```

> **Security:** this compiles and executes arbitrary user-submitted Java in a
> child JVM with **no sandbox**. It binds to `127.0.0.1` only and caps each run
> at 15 seconds / 4000 steps. Do not expose the port to a network or deploy it
> on a shared host without container/seccomp isolation first.

---

## What you get

**Home** — a catalog of 54 classic algorithms across 11 categories, generated
from `presets.js` (add an entry there and the catalog picks it up automatically).

**Visualizer** — five synchronized panels:

| Panel | Shows |
| --- | --- |
| Editor | your Java source; stop typing for 900 ms and it re-traces automatically |
| Running line | the source with the executing line highlighted |
| Figure | the data structure, animated — bars, boxes, matrix, pointers |
| What's happening | one sentence per step, in Vietnamese and English |
| Step log · Stack · Output | the last 9 narrations, the call stack, the program's stdout |

Playback: step forward/back, jump to first/last, scrub to any step, play at
0.5× / 1× / 2× / 4×.

### The figure adapts to the data

| Value in scope | Rendered as |
| --- | --- |
| `int[]` / `long[]` | bar chart with value and index labels |
| array of only `0`/`1` (visited, sieve) | flag boxes, set entries filled |
| array that never changes (offset tables) | compact box row, not a chart |
| `int[][]` | heat-mapped matrix |
| `String` | character boxes |
| `ArrayList`, `ArrayDeque` | contents in real order (the deque's circular buffer is unwrapped) |
| linked-list nodes (`next` + `val`/`value`/`data`) | the chain, followed up to 64 nodes |
| `HashMap`, `LinkedHashMap` | `key → value` entries, walked out of the bucket table |
| `StringBuilder` | the text it currently holds |
| plain numbers | a chip plus a sparkline of every value it has held so far |

### Pointer tracking

Locals with index-like names (`i`, `j`, `mid`, `lo`, `hi`, `left`, `right`,
`head`, `tail`, …) are drawn as colored chips that **slide** to their position as
they move. Pairs like `lo`/`hi` or `left`/`right` dim everything outside the live
window, so binary search and sliding window read at a glance. A pointer is only
attached to the array the running line actually indexes.

### Narration

Each step's sentence is derived from the diff between two snapshots — no
per-algorithm configuration:

```
Hoán đổi a[2] ↔ a[3]            swap a[2] ↔ a[3]
exp: 1 → 0                      exp: 1 → 0
queue[4] = 4 (trước là 0)       queue[4] = 4 (was 0)
Gọi hàm mergeSort()             Call mergeSort()
Trả về từ fib()                 Return from fib()
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
presets.js        the 54 algorithms, grouped by category
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

---

## Limits

- **Pointer detection is name-based.** A cursor called `cursor` is missed; a
  value variable named `i` is mislabelled as an index. Inferring it from
  bytecode array access would fix this.
- **Depth cap.** Object graphs are serialized 10 levels deep — long `HashMap`
  bucket chains, treeified buckets and long linked lists truncate past that.
- **Step cap.** 4000 steps or 15 seconds per run, whichever comes first; the UI
  says `CẮT BỚT / truncated` when a run is cut.
- **One class.** Your code must fit in a single `Main.java`.

## License

Code: see `LICENSE`. The bundled fonts (JetBrains Mono, Space Grotesk) ship
under the SIL Open Font License.
