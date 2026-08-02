// Classic algorithms, grouped for the preset menu.
// Inputs are kept tiny on purpose: the tracer records every executed line, so a
// 20-element sort blows past the step cap while an 8-element one reads clearly.
const PRESETS = {

  "Sorting": {

    "Bubble sort": `public class Main {
    public static void main(String[] args) {
        int[] a = {5, 2, 9, 1, 7, 3, 8, 4};
        for (int i = 0; i < a.length - 1; i++) {
            for (int j = 0; j < a.length - 1 - i; j++) {
                if (a[j] > a[j + 1]) {
                    int tmp = a[j];
                    a[j] = a[j + 1];
                    a[j + 1] = tmp;
                }
            }
        }
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Selection sort": `public class Main {
    public static void main(String[] args) {
        int[] a = {5, 2, 9, 1, 7, 3};
        for (int i = 0; i < a.length - 1; i++) {
            int min = i;
            for (int j = i + 1; j < a.length; j++)
                if (a[j] < a[min]) min = j;
            int tmp = a[i];
            a[i] = a[min];
            a[min] = tmp;
        }
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Insertion sort": `public class Main {
    public static void main(String[] args) {
        int[] a = {6, 3, 8, 1, 9, 2, 7};
        for (int i = 1; i < a.length; i++) {
            int key = a[i];
            int j = i - 1;
            while (j >= 0 && a[j] > key) {
                a[j + 1] = a[j];
                j--;
            }
            a[j + 1] = key;
        }
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Merge sort": `public class Main {
    static void mergeSort(int[] a, int lo, int hi) {
        if (lo >= hi) return;
        int mid = (lo + hi) / 2;
        mergeSort(a, lo, mid);
        mergeSort(a, mid + 1, hi);
        int[] buf = new int[hi - lo + 1];
        int i = lo, j = mid + 1, k = 0;
        while (i <= mid && j <= hi)
            buf[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];
        while (i <= mid) buf[k++] = a[i++];
        while (j <= hi) buf[k++] = a[j++];
        for (int t = 0; t < buf.length; t++) a[lo + t] = buf[t];
    }
    public static void main(String[] args) {
        int[] a = {5, 2, 9, 1, 7, 3};
        mergeSort(a, 0, a.length - 1);
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Quick sort (Lomuto)": `public class Main {
    static void quickSort(int[] a, int lo, int hi) {
        if (lo >= hi) return;
        int pivot = a[hi], i = lo - 1;
        for (int j = lo; j < hi; j++) {
            if (a[j] <= pivot) {
                i++;
                int t = a[i]; a[i] = a[j]; a[j] = t;
            }
        }
        int t = a[i + 1]; a[i + 1] = a[hi]; a[hi] = t;
        quickSort(a, lo, i);
        quickSort(a, i + 2, hi);
    }
    public static void main(String[] args) {
        int[] a = {5, 2, 9, 1, 7, 3};
        quickSort(a, 0, a.length - 1);
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Heap sort": `public class Main {
    static void siftDown(int[] a, int i, int n) {
        while (2 * i + 1 < n) {
            int big = 2 * i + 1;
            if (big + 1 < n && a[big + 1] > a[big]) big++;
            if (a[i] >= a[big]) return;
            int t = a[i]; a[i] = a[big]; a[big] = t;
            i = big;
        }
    }
    public static void main(String[] args) {
        int[] a = {5, 2, 9, 1, 7, 3};
        for (int i = a.length / 2 - 1; i >= 0; i--) siftDown(a, i, a.length);
        for (int end = a.length - 1; end > 0; end--) {
            int t = a[0]; a[0] = a[end]; a[end] = t;
            siftDown(a, 0, end);
        }
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Counting sort": `public class Main {
    public static void main(String[] args) {
        int[] a = {4, 2, 2, 0, 3, 1, 4};
        int[] count = new int[5];
        for (int i = 0; i < a.length; i++) count[a[i]]++;
        for (int v = 1; v < count.length; v++) count[v] += count[v - 1];
        int[] out = new int[a.length];
        for (int i = a.length - 1; i >= 0; i--) out[--count[a[i]]] = a[i];
        System.out.println(java.util.Arrays.toString(out));
    }
}`
  },

  "Searching": {

    "Linear search": `public class Main {
    public static void main(String[] args) {
        int[] a = {7, 3, 9, 1, 5, 8};
        int target = 5, found = -1;
        for (int i = 0; i < a.length; i++) {
            if (a[i] == target) { found = i; break; }
        }
        System.out.println("index = " + found);
    }
}`,

    "Binary search": `public class Main {
    public static void main(String[] args) {
        int[] a = {1, 3, 5, 7, 9, 11, 13, 15};
        int target = 11;
        int lo = 0, hi = a.length - 1, found = -1;
        while (lo <= hi) {
            int mid = (lo + hi) / 2;
            if (a[mid] == target) { found = mid; break; }
            if (a[mid] < target) lo = mid + 1; else hi = mid - 1;
        }
        System.out.println("index = " + found);
    }
}`,

    "Binary search on answer (sqrt)": `public class Main {
    // Smallest x with x*x >= n — the "search the answer space" pattern.
    public static void main(String[] args) {
        int n = 60;
        int lo = 0, hi = n, best = -1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (mid * mid >= n) { best = mid; hi = mid - 1; }
            else lo = mid + 1;
        }
        System.out.println("ceil(sqrt(" + n + ")) = " + best);
    }
}`,

    "Two pointers — pair sum": `public class Main {
    public static void main(String[] args) {
        int[] a = {1, 3, 4, 6, 8, 11};   // must be sorted
        int target = 14;
        int left = 0, right = a.length - 1;
        while (left < right) {
            int sum = a[left] + a[right];
            if (sum == target) break;
            if (sum < target) left++; else right--;
        }
        System.out.println(a[left] + " + " + a[right] + " = " + target);
    }
}`,

    "Sliding window — longest substring": `import java.util.HashMap;
import java.util.Map;

public class Main {
    // Chuỗi con dài nhất KHÔNG có ký tự lặp. O(n) time, O(k) space.
    static int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> last = new HashMap<>(); // vị trí cuối của ký tự
        int best = 0, left = 0;                         // left = mép trái cửa sổ
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            // c đã có TRONG cửa sổ -> co mép trái qua khỏi vị trí cũ
            if (last.containsKey(c) && last.get(c) >= left)
                left = last.get(c) + 1;
            last.put(c, right);
            best = Math.max(best, right - left + 1);
        }
        return best;
    }

    public static void main(String[] args) {
        assert lengthOfLongestSubstring("abcabcbb") == 3; // "abc"
        assert lengthOfLongestSubstring("bbbbb") == 1;    // "b"
        assert lengthOfLongestSubstring("") == 0;
        System.out.println("OK");
    }
}`,

    "Sliding window — max sum of k": `public class Main {
    public static void main(String[] args) {
        int[] a = {2, 1, 5, 1, 3, 2, 8};
        int k = 3, sum = 0;
        for (int i = 0; i < k; i++) sum += a[i];
        int best = sum;
        for (int right = k; right < a.length; right++) {
            int left = right - k;
            sum += a[right] - a[left];
            best = Math.max(best, sum);
        }
        System.out.println("max sum of " + k + " = " + best);
    }
}`
  },

  "Arrays": {

    "Kadane — max subarray": `public class Main {
    public static void main(String[] args) {
        int[] a = {-2, 1, -3, 4, -1, 2, 1, -5};
        int cur = a[0], best = a[0];
        for (int i = 1; i < a.length; i++) {
            cur = Math.max(a[i], cur + a[i]);
            best = Math.max(best, cur);
        }
        System.out.println("max subarray sum = " + best);
    }
}`,

    "Prefix sums — range query": `public class Main {
    public static void main(String[] args) {
        int[] a = {3, 1, 4, 1, 5, 9, 2};
        int[] prefix = new int[a.length + 1];
        for (int i = 0; i < a.length; i++) prefix[i + 1] = prefix[i] + a[i];
        int lo = 2, hi = 5;                      // sum of a[2..5]
        int sum = prefix[hi + 1] - prefix[lo];
        System.out.println("sum a[2..5] = " + sum);
    }
}`,

    "Dutch national flag (sort 0/1/2)": `public class Main {
    public static void main(String[] args) {
        int[] a = {2, 0, 2, 1, 1, 0, 1};
        int low = 0, mid = 0, high = a.length - 1;
        while (mid <= high) {
            if (a[mid] == 0) {
                int t = a[low]; a[low] = a[mid]; a[mid] = t;
                low++; mid++;
            } else if (a[mid] == 2) {
                int t = a[high]; a[high] = a[mid]; a[mid] = t;
                high--;
            } else mid++;
        }
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Reverse & rotate in place": `public class Main {
    static void reverse(int[] a, int left, int right) {
        while (left < right) {
            int t = a[left]; a[left] = a[right]; a[right] = t;
            left++; right--;
        }
    }
    public static void main(String[] args) {
        int[] a = {1, 2, 3, 4, 5, 6, 7};
        int k = 3;                       // rotate right by k
        reverse(a, 0, a.length - 1);
        reverse(a, 0, k - 1);
        reverse(a, k, a.length - 1);
        System.out.println(java.util.Arrays.toString(a));
    }
}`,

    "Remove duplicates (sorted)": `public class Main {
    public static void main(String[] args) {
        int[] a = {1, 1, 2, 3, 3, 3, 4};
        int write = 1;
        for (int read = 1; read < a.length; read++) {
            if (a[read] != a[write - 1]) {
                a[write] = a[read];
                write++;
            }
        }
        System.out.println("unique count = " + write);
    }
}`,

    "Moore majority vote": `public class Main {
    public static void main(String[] args) {
        int[] a = {3, 3, 4, 2, 3, 3, 3};
        int candidate = a[0], count = 0;
        for (int i = 0; i < a.length; i++) {
            if (count == 0) candidate = a[i];
            count += (a[i] == candidate) ? 1 : -1;
        }
        System.out.println("majority = " + candidate);
    }
}`
  },

  "Strings": {

    "Palindrome check": `public class Main {
    public static void main(String[] args) {
        String s = "racecar";
        int left = 0, right = s.length() - 1;
        boolean ok = true;
        while (left < right) {
            if (s.charAt(left) != s.charAt(right)) { ok = false; break; }
            left++; right--;
        }
        System.out.println(s + " palindrome? " + ok);
    }
}`,

    "Anagram check": `public class Main {
    public static void main(String[] args) {
        String s = "listen", t = "silent";
        int[] count = new int[26];
        for (int i = 0; i < s.length(); i++) count[s.charAt(i) - 'a']++;
        for (int i = 0; i < t.length(); i++) count[t.charAt(i) - 'a']--;
        boolean ok = true;
        for (int c = 0; c < 26; c++) if (count[c] != 0) ok = false;
        System.out.println("anagram? " + ok);
    }
}`,

    "KMP — prefix function": `public class Main {
    public static void main(String[] args) {
        String p = "ababaca";
        int[] pi = new int[p.length()];
        for (int i = 1; i < p.length(); i++) {
            int k = pi[i - 1];
            while (k > 0 && p.charAt(i) != p.charAt(k)) k = pi[k - 1];
            if (p.charAt(i) == p.charAt(k)) k++;
            pi[i] = k;
        }
        System.out.println(java.util.Arrays.toString(pi));
    }
}`,

    "Reverse words": `public class Main {
    public static void main(String[] args) {
        char[] a = "the sky is".toCharArray();
        int left = 0, right = a.length - 1;
        while (left < right) {                        // reverse everything
            char t = a[left]; a[left] = a[right]; a[right] = t;
            left++; right--;
        }
        int start = 0;
        for (int i = 0; i <= a.length; i++) {          // then each word back
            if (i == a.length || a[i] == ' ') {
                int lo = start, hi = i - 1;
                while (lo < hi) {
                    char t = a[lo]; a[lo] = a[hi]; a[hi] = t;
                    lo++; hi--;
                }
                start = i + 1;
            }
        }
        System.out.println(new String(a));
    }
}`
  },

  "Linked list": {

    "Reverse a linked list": `public class Main {
    static class Node {
        int val;
        Node next;
        Node(int v) { val = v; }
    }
    public static void main(String[] args) {
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);

        Node prev = null, cur = head;
        while (cur != null) {
            Node ahead = cur.next;
            cur.next = prev;
            prev = cur;
            cur = ahead;
        }
        StringBuilder sb = new StringBuilder();
        for (Node n = prev; n != null; n = n.next) sb.append(n.val).append(' ');
        System.out.println(sb.toString().trim());
    }
}`,

    "Floyd cycle detection": `public class Main {
    static class Node {
        int val;
        Node next;
        Node(int v) { val = v; }
    }
    public static void main(String[] args) {
        Node head = new Node(1);
        head.next = new Node(2);
        head.next.next = new Node(3);
        head.next.next.next = new Node(4);
        head.next.next.next.next = head.next;    // cycle back to node 2

        Node slow = head, fast = head;
        boolean hasCycle = false;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) { hasCycle = true; break; }
        }
        System.out.println("cycle? " + hasCycle);
    }
}`,

    "Merge two sorted lists": `public class Main {
    static class Node {
        int val;
        Node next;
        Node(int v) { val = v; }
    }
    public static void main(String[] args) {
        Node a = new Node(1); a.next = new Node(4); a.next.next = new Node(6);
        Node b = new Node(2); b.next = new Node(3); b.next.next = new Node(7);

        Node dummy = new Node(0), tail = dummy;
        while (a != null && b != null) {
            if (a.val <= b.val) { tail.next = a; a = a.next; }
            else { tail.next = b; b = b.next; }
            tail = tail.next;
        }
        tail.next = (a != null) ? a : b;

        StringBuilder sb = new StringBuilder();
        for (Node n = dummy.next; n != null; n = n.next) sb.append(n.val).append(' ');
        System.out.println(sb.toString().trim());
    }
}`
  },

  "Stack & queue": {

    "Balanced parentheses": `public class Main {
    public static void main(String[] args) {
        String s = "{[()]}";
        char[] stack = new char[s.length()];
        int top = 0;
        boolean ok = true;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '(' || c == '[' || c == '{') stack[top++] = c;
            else {
                if (top == 0) { ok = false; break; }
                char open = stack[--top];
                if ((c == ')' && open != '(') || (c == ']' && open != '[')
                        || (c == '}' && open != '{')) { ok = false; break; }
            }
        }
        System.out.println("balanced? " + (ok && top == 0));
    }
}`,

    "Monotonic stack — next greater": `public class Main {
    public static void main(String[] args) {
        int[] a = {2, 1, 5, 6, 2, 3};
        int[] result = new int[a.length];
        int[] stack = new int[a.length];        // holds indices
        int top = 0;
        for (int i = 0; i < a.length; i++) {
            while (top > 0 && a[stack[top - 1]] < a[i]) {
                int idx = stack[--top];
                result[idx] = a[i];
            }
            stack[top++] = i;
        }
        System.out.println(java.util.Arrays.toString(result));
    }
}`,

    "Queue via two stacks": `public class Main {
    public static void main(String[] args) {
        int[] in = new int[8], out = new int[8];
        int inTop = 0, outTop = 0;
        for (int v = 1; v <= 4; v++) in[inTop++] = v;   // enqueue 1..4
        StringBuilder sb = new StringBuilder();
        for (int popped = 0; popped < 4; popped++) {
            if (outTop == 0)
                while (inTop > 0) out[outTop++] = in[--inTop];
            sb.append(out[--outTop]).append(' ');
        }
        System.out.println(sb.toString().trim());
    }
}`
  },

  "Trees": {

    "BST insert & search": `public class Main {
    static class Node {
        int val;
        Node left, right;
        Node(int v) { val = v; }
    }
    static Node insert(Node root, int v) {
        if (root == null) return new Node(v);
        if (v < root.val) root.left = insert(root.left, v);
        else root.right = insert(root.right, v);
        return root;
    }
    public static void main(String[] args) {
        int[] values = {5, 3, 8, 1, 4};
        Node root = null;
        for (int i = 0; i < values.length; i++) root = insert(root, values[i]);

        int target = 4;
        Node cur = root;
        boolean found = false;
        while (cur != null) {
            if (cur.val == target) { found = true; break; }
            cur = (target < cur.val) ? cur.left : cur.right;
        }
        System.out.println("found " + target + "? " + found);
    }
}`,

    "Inorder traversal (array tree)": `public class Main {
    // Tree stored heap-style: children of i are 2i+1 and 2i+2, -1 = empty.
    static int[] tree = {5, 3, 8, 1, 4, -1, 9};
    static int[] visited = new int[7];
    static int order = 1;

    static void inorder(int i) {
        if (i >= tree.length || tree[i] == -1) return;
        inorder(2 * i + 1);
        visited[i] = order++;
        inorder(2 * i + 2);
    }
    public static void main(String[] args) {
        inorder(0);
        System.out.println(java.util.Arrays.toString(visited));
    }
}`,

    "Level order (BFS on array tree)": `public class Main {
    public static void main(String[] args) {
        int[] tree = {5, 3, 8, 1, 4, -1, 9};
        int[] queue = new int[16];
        int head = 0, tail = 0;
        queue[tail++] = 0;
        StringBuilder sb = new StringBuilder();
        while (head < tail) {
            int i = queue[head++];
            if (i >= tree.length || tree[i] == -1) continue;
            sb.append(tree[i]).append(' ');
            queue[tail++] = 2 * i + 1;
            queue[tail++] = 2 * i + 2;
        }
        System.out.println(sb.toString().trim());
    }
}`,

    "Tree height": `public class Main {
    static int[] tree = {5, 3, 8, 1, 4, -1, 9};

    static int height(int i) {
        if (i >= tree.length || tree[i] == -1) return 0;
        int left = height(2 * i + 1);
        int right = height(2 * i + 2);
        return 1 + Math.max(left, right);
    }
    public static void main(String[] args) {
        System.out.println("height = " + height(0));
    }
}`
  },

  "Graphs": {

    "BFS on grid": `public class Main {
    public static void main(String[] args) {
        int[][] grid = {{0,0,0,1},{1,1,0,1},{0,0,0,0},{0,1,1,0}};
        int[] dist = new int[16];
        java.util.Arrays.fill(dist, -1);
        java.util.ArrayDeque<Integer> queue = new java.util.ArrayDeque<>();
        queue.add(0);
        dist[0] = 0;
        int[] dr = {1,-1,0,0}, dc = {0,0,1,-1};
        while (!queue.isEmpty()) {
            int cur = queue.poll();
            int r = cur / 4, c = cur % 4;
            for (int k = 0; k < 4; k++) {
                int nr = r + dr[k], nc = c + dc[k];
                if (nr < 0 || nr > 3 || nc < 0 || nc > 3) continue;
                if (grid[nr][nc] == 1 || dist[nr * 4 + nc] != -1) continue;
                dist[nr * 4 + nc] = dist[cur] + 1;
                queue.add(nr * 4 + nc);
            }
        }
        System.out.println(dist[15]);
    }
}`,

    "DFS on adjacency matrix": `public class Main {
    static int[][] adj = {
        {0,1,1,0,0},
        {1,0,0,1,0},
        {1,0,0,1,0},
        {0,1,1,0,1},
        {0,0,0,1,0}};
    static int[] visited = new int[5];
    static int order = 1;

    static void dfs(int cur) {
        visited[cur] = order++;
        for (int next = 0; next < 5; next++)
            if (adj[cur][next] == 1 && visited[next] == 0) dfs(next);
    }
    public static void main(String[] args) {
        dfs(0);
        System.out.println(java.util.Arrays.toString(visited));
    }
}`,

    "Dijkstra (adjacency matrix)": `public class Main {
    public static void main(String[] args) {
        final int INF = 999;
        int[][] w = {
            {0, 4, 1, INF, INF},
            {4, 0, 2, 5, INF},
            {1, 2, 0, 8, 10},
            {INF, 5, 8, 0, 2},
            {INF, INF, 10, 2, 0}};
        int[] dist = {0, INF, INF, INF, INF};
        int[] done = new int[5];
        for (int step = 0; step < 5; step++) {
            int cur = -1;
            for (int v = 0; v < 5; v++)
                if (done[v] == 0 && (cur == -1 || dist[v] < dist[cur])) cur = v;
            done[cur] = 1;
            for (int next = 0; next < 5; next++)
                if (w[cur][next] != INF && dist[cur] + w[cur][next] < dist[next])
                    dist[next] = dist[cur] + w[cur][next];
        }
        System.out.println(java.util.Arrays.toString(dist));
    }
}`,

    "Topological sort (Kahn)": `public class Main {
    public static void main(String[] args) {
        int[][] adj = {
            {0,1,1,0,0},
            {0,0,0,1,0},
            {0,0,0,1,0},
            {0,0,0,0,1},
            {0,0,0,0,0}};
        int[] indegree = new int[5];
        for (int u = 0; u < 5; u++)
            for (int v = 0; v < 5; v++) indegree[v] += adj[u][v];

        int[] queue = new int[5];
        int head = 0, tail = 0;
        for (int v = 0; v < 5; v++) if (indegree[v] == 0) queue[tail++] = v;

        StringBuilder sb = new StringBuilder();
        while (head < tail) {
            int cur = queue[head++];
            sb.append(cur).append(' ');
            for (int next = 0; next < 5; next++) {
                if (adj[cur][next] == 0) continue;
                indegree[next]--;
                if (indegree[next] == 0) queue[tail++] = next;
            }
        }
        System.out.println(sb.toString().trim());
    }
}`,

    "Union-Find (DSU)": `public class Main {
    static int[] parent = {0, 1, 2, 3, 4, 5};

    static int find(int x) {
        while (parent[x] != x) {
            parent[x] = parent[parent[x]];   // path halving
            x = parent[x];
        }
        return x;
    }
    static void union(int a, int b) {
        int ra = find(a), rb = find(b);
        if (ra != rb) parent[rb] = ra;
    }
    public static void main(String[] args) {
        union(0, 1);
        union(2, 3);
        union(1, 3);
        union(4, 5);
        System.out.println("0 and 3 connected? " + (find(0) == find(3)));
    }
}`,

    "Floyd-Warshall": `public class Main {
    public static void main(String[] args) {
        final int INF = 99;
        int[][] d = {
            {0, 3, INF, 7},
            {8, 0, 2, INF},
            {5, INF, 0, 1},
            {2, INF, INF, 0}};
        for (int k = 0; k < 4; k++)
            for (int i = 0; i < 4; i++)
                for (int j = 0; j < 4; j++)
                    if (d[i][k] + d[k][j] < d[i][j]) d[i][j] = d[i][k] + d[k][j];
        System.out.println(java.util.Arrays.deepToString(d));
    }
}`
  },

  "Dynamic programming": {

    "Fibonacci (recursion)": `public class Main {
    static int fib(int n) {
        if (n < 2) return n;
        return fib(n - 1) + fib(n - 2);
    }
    public static void main(String[] args) {
        int result = fib(7);
        System.out.println(result);
    }
}`,

    "Fibonacci (memoised)": `public class Main {
    static int[] memo = new int[12];

    static int fib(int n) {
        if (n < 2) return n;
        if (memo[n] != 0) return memo[n];
        memo[n] = fib(n - 1) + fib(n - 2);
        return memo[n];
    }
    public static void main(String[] args) {
        System.out.println(fib(11));
    }
}`,

    "0/1 Knapsack": `public class Main {
    public static void main(String[] args) {
        int[] weight = {2, 3, 4};
        int[] value = {3, 4, 6};
        int cap = 6;
        int[][] dp = new int[4][7];          // dp[i][c] = best value using first i items
        for (int i = 1; i <= 3; i++) {
            for (int c = 0; c <= cap; c++) {
                dp[i][c] = dp[i - 1][c];                       // skip item i
                if (weight[i - 1] <= c)
                    dp[i][c] = Math.max(dp[i][c],
                               dp[i - 1][c - weight[i - 1]] + value[i - 1]);
            }
        }
        System.out.println("best = " + dp[3][cap]);
    }
}`,

    "Longest common subsequence": `public class Main {
    public static void main(String[] args) {
        String a = "ABCB", b = "BDCB";
        int[][] dp = new int[5][5];
        for (int i = 1; i <= 4; i++) {
            for (int j = 1; j <= 4; j++) {
                if (a.charAt(i - 1) == b.charAt(j - 1))
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                else
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
        System.out.println("LCS length = " + dp[4][4]);
    }
}`,

    "Edit distance": `public class Main {
    public static void main(String[] args) {
        String a = "kitt", b = "sitt";
        int[][] dp = new int[5][5];
        for (int i = 0; i <= 4; i++) dp[i][0] = i;
        for (int j = 0; j <= 4; j++) dp[0][j] = j;
        for (int i = 1; i <= 4; i++) {
            for (int j = 1; j <= 4; j++) {
                int cost = (a.charAt(i - 1) == b.charAt(j - 1)) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                                    dp[i - 1][j - 1] + cost);
            }
        }
        System.out.println("edit distance = " + dp[4][4]);
    }
}`,

    "Coin change (min coins)": `public class Main {
    public static void main(String[] args) {
        int[] coins = {1, 3, 4};
        int target = 9;
        int[] dp = new int[10];
        java.util.Arrays.fill(dp, 99);
        dp[0] = 0;
        for (int amount = 1; amount <= target; amount++)
            for (int k = 0; k < coins.length; k++)
                if (coins[k] <= amount)
                    dp[amount] = Math.min(dp[amount], dp[amount - coins[k]] + 1);
        System.out.println("min coins = " + dp[target]);
    }
}`,

    "Longest increasing subsequence": `public class Main {
    public static void main(String[] args) {
        int[] a = {3, 1, 4, 2, 5};
        int[] dp = new int[a.length];
        java.util.Arrays.fill(dp, 1);
        int best = 1;
        for (int i = 1; i < a.length; i++) {
            for (int j = 0; j < i; j++)
                if (a[j] < a[i]) dp[i] = Math.max(dp[i], dp[j] + 1);
            best = Math.max(best, dp[i]);
        }
        System.out.println("LIS length = " + best);
    }
}`,

    "Climbing stairs": `public class Main {
    public static void main(String[] args) {
        int n = 8;
        int[] dp = new int[n + 1];
        dp[0] = 1;
        dp[1] = 1;
        for (int i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
        System.out.println("ways = " + dp[n]);
    }
}`
  },

  "Backtracking": {

    "N-Queens (4×4)": `public class Main {
    static int[] queen = {-1, -1, -1, -1};   // queen[row] = column
    static int solutions = 0;

    static boolean safe(int row, int col) {
        for (int r = 0; r < row; r++) {
            int c = queen[r];
            if (c == col || Math.abs(c - col) == row - r) return false;
        }
        return true;
    }
    static void place(int row) {
        if (row == 4) { solutions++; return; }
        for (int col = 0; col < 4; col++) {
            if (!safe(row, col)) continue;
            queen[row] = col;
            place(row + 1);
            queen[row] = -1;                 // undo
        }
    }
    public static void main(String[] args) {
        place(0);
        System.out.println("solutions = " + solutions);
    }
}`,

    "Subsets (power set)": `public class Main {
    static int[] a = {1, 2, 3};
    static int[] pick = new int[3];
    static int count = 0;

    static void build(int i) {
        if (i == a.length) { count++; return; }
        pick[i] = 0;             // exclude a[i]
        build(i + 1);
        pick[i] = 1;             // include a[i]
        build(i + 1);
    }
    public static void main(String[] args) {
        build(0);
        System.out.println("subsets = " + count);
    }
}`,

    "Permutations": `public class Main {
    static int[] a = {1, 2, 3};
    static int count = 0;

    static void permute(int start) {
        if (start == a.length) { count++; return; }
        for (int i = start; i < a.length; i++) {
            int t = a[start]; a[start] = a[i]; a[i] = t;
            permute(start + 1);
            t = a[start]; a[start] = a[i]; a[i] = t;    // undo
        }
    }
    public static void main(String[] args) {
        permute(0);
        System.out.println("permutations = " + count);
    }
}`
  },

  "Math": {

    "GCD (Euclid)": `public class Main {
    public static void main(String[] args) {
        int a = 48, b = 18;
        while (b != 0) {
            int t = b;
            b = a % b;
            a = t;
        }
        System.out.println("gcd = " + a);
    }
}`,

    "Sieve of Eratosthenes": `public class Main {
    public static void main(String[] args) {
        int n = 30;
        int[] composite = new int[n + 1];      // 0 = prime, 1 = composite
        for (int p = 2; p * p <= n; p++) {
            if (composite[p] == 1) continue;
            for (int m = p * p; m <= n; m += p) composite[m] = 1;
        }
        StringBuilder sb = new StringBuilder();
        for (int v = 2; v <= n; v++) if (composite[v] == 0) sb.append(v).append(' ');
        System.out.println(sb.toString().trim());
    }
}`,

    "Fast power (binary exponentiation)": `public class Main {
    public static void main(String[] args) {
        long base = 3, result = 1;
        int exp = 13;
        while (exp > 0) {
            if ((exp & 1) == 1) result = result * base;
            base = base * base;
            exp >>= 1;
        }
        System.out.println("3^13 = " + result);
    }
}`,

    "Prime check (trial division)": `public class Main {
    public static void main(String[] args) {
        int n = 97;
        boolean prime = n > 1;
        for (int d = 2; d * d <= n; d++) {
            if (n % d == 0) { prime = false; break; }
        }
        System.out.println(n + " prime? " + prime);
    }
}`
  }
};

// Per-algorithm metadata for the design's COMPLEXITY card and the category tabs:
// [average time, space]. Category and file name are derived from the group.
const COMPLEXITY = {
  "Bubble sort": ["O(n²)", "O(1)"],
  "Selection sort": ["O(n²)", "O(1)"],
  "Insertion sort": ["O(n²)", "O(1)"],
  "Merge sort": ["O(n log n)", "O(n)"],
  "Quick sort (Lomuto)": ["O(n log n)", "O(log n)"],
  "Heap sort": ["O(n log n)", "O(1)"],
  "Counting sort": ["O(n + k)", "O(k)"],

  "Linear search": ["O(n)", "O(1)"],
  "Binary search": ["O(log n)", "O(1)"],
  "Binary search on answer (sqrt)": ["O(log n)", "O(1)"],
  "Two pointers — pair sum": ["O(n)", "O(1)"],
  "Sliding window — longest substring": ["O(n)", "O(k)"],
  "Sliding window — max sum of k": ["O(n)", "O(1)"],

  "Kadane — max subarray": ["O(n)", "O(1)"],
  "Prefix sums — range query": ["O(n)", "O(n)"],
  "Dutch national flag (sort 0/1/2)": ["O(n)", "O(1)"],
  "Reverse & rotate in place": ["O(n)", "O(1)"],
  "Remove duplicates (sorted)": ["O(n)", "O(1)"],
  "Moore majority vote": ["O(n)", "O(1)"],

  "Palindrome check": ["O(n)", "O(1)"],
  "Anagram check": ["O(n)", "O(1)"],
  "KMP — prefix function": ["O(n)", "O(n)"],
  "Reverse words": ["O(n)", "O(1)"],

  "Reverse a linked list": ["O(n)", "O(1)"],
  "Floyd cycle detection": ["O(n)", "O(1)"],
  "Merge two sorted lists": ["O(n + m)", "O(1)"],

  "Balanced parentheses": ["O(n)", "O(n)"],
  "Monotonic stack — next greater": ["O(n)", "O(n)"],
  "Queue via two stacks": ["O(1) khấu hao", "O(n)"],

  "BST insert & search": ["O(h)", "O(h)"],
  "Inorder traversal (array tree)": ["O(n)", "O(h)"],
  "Level order (BFS on array tree)": ["O(n)", "O(n)"],
  "Tree height": ["O(n)", "O(h)"],

  "BFS on grid": ["O(V + E)", "O(V)"],
  "DFS on adjacency matrix": ["O(V²)", "O(V)"],
  "Dijkstra (adjacency matrix)": ["O(V²)", "O(V)"],
  "Topological sort (Kahn)": ["O(V + E)", "O(V)"],
  "Union-Find (DSU)": ["O(α(n))", "O(n)"],
  "Floyd-Warshall": ["O(V³)", "O(V²)"],

  "Fibonacci (recursion)": ["O(2ⁿ)", "O(n)"],
  "Fibonacci (memoised)": ["O(n)", "O(n)"],
  "0/1 Knapsack": ["O(n·W)", "O(n·W)"],
  "Longest common subsequence": ["O(n·m)", "O(n·m)"],
  "Edit distance": ["O(n·m)", "O(n·m)"],
  "Coin change (min coins)": ["O(n·A)", "O(A)"],
  "Longest increasing subsequence": ["O(n²)", "O(n)"],
  "Climbing stairs": ["O(n)", "O(n)"],

  "N-Queens (4×4)": ["O(n!)", "O(n)"],
  "Subsets (power set)": ["O(2ⁿ)", "O(n)"],
  "Permutations": ["O(n!)", "O(n)"],

  "GCD (Euclid)": ["O(log n)", "O(1)"],
  "Sieve of Eratosthenes": ["O(n log log n)", "O(n)"],
  "Fast power (binary exponentiation)": ["O(log n)", "O(1)"],
  "Prime check (trial division)": ["O(√n)", "O(1)"]
};

// The design's category tab row: id + "Vietnamese / English" label.
const CATS = [
  ["Sorting", "Sắp xếp / Sorting"],
  ["Searching", "Tìm kiếm / Search"],
  ["Arrays", "Mảng / Arrays"],
  ["Strings", "Chuỗi / Strings"],
  ["Linked list", "Danh sách / Linked list"],
  ["Stack & queue", "Cấu trúc / Structures"],
  ["Trees", "Cây / Trees"],
  ["Graphs", "Đồ thị / Graph"],
  ["Dynamic programming", "QHĐ / DP"],
  ["Backtracking", "Đệ quy / Backtracking"],
  ["Math", "Toán / Math"]
];

// The design pins a view per algorithm (META.kind), and only the sorts plus
// linear/binary search use bars. Everything else gets graph / tree / table /
// linear / stack / queue. Entries may name the rows of a table explicitly.
const VIEW = {
  "Bubble sort": "bars",
  "Selection sort": "bars",
  "Insertion sort": "bars",
  "Merge sort": "bars",
  "Quick sort (Lomuto)": "bars",
  "Heap sort": "bars",
  "Counting sort": "bars",

  "Linear search": "bars",
  "Binary search": "bars",
  "Binary search on answer (sqrt)": "none",
  "Two pointers — pair sum": "bars",
  "Sliding window — longest substring": "linear",
  "Sliding window — max sum of k": "bars",

  "Kadane — max subarray": "table",
  "Prefix sums — range query": "table",
  "Dutch national flag (sort 0/1/2)": "linear",
  "Reverse & rotate in place": "linear",
  "Remove duplicates (sorted)": "linear",
  "Moore majority vote": "linear",

  "Palindrome check": "linear",
  "Anagram check": "table",
  "KMP — prefix function": { kind: "table", rows: ["p", "pi"] },
  "Reverse words": "linear",

  "Reverse a linked list": "list",
  "Floyd cycle detection": "list",
  "Merge two sorted lists": "list",

  "Balanced parentheses": "stack",
  "Monotonic stack — next greater": "stack",
  "Queue via two stacks": "stack",

  "BST insert & search": "tree",
  "Inorder traversal (array tree)": "tree",
  "Level order (BFS on array tree)": "tree",
  "Tree height": "tree",

  "BFS on grid": "table",
  "DFS on adjacency matrix": "graph",
  "Dijkstra (adjacency matrix)": "graph",
  "Topological sort (Kahn)": "graph",
  "Union-Find (DSU)": "forest",
  "Floyd-Warshall": "table",

  "Fibonacci (recursion)": "none",
  "Fibonacci (memoised)": "table",
  "0/1 Knapsack": "table",
  "Longest common subsequence": "table",
  "Edit distance": "table",
  "Coin change (min coins)": "table",
  "Longest increasing subsequence": "table",
  "Climbing stairs": "table",

  "N-Queens (4×4)": { kind: "board", var: "queen" },
  "Subsets (power set)": "table",
  "Permutations": "linear",

  "GCD (Euclid)": "none",
  "Sieve of Eratosthenes": "linear",
  "Fast power (binary exponentiation)": "none",
  "Prime check (trial division)": "none"
};
