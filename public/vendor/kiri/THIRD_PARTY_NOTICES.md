# Third-party notices for `engine.js` / `worker.js` / `minion.js`

`engine.js` (main thread), `worker.js` (a real Web Worker — required: engine.js's own `newEngine()`
creates one internally for the actual slice/prepare/export work, it's not optional), and `minion.js`
(the worker's own sub-worker pool — real CPU-core-count parallelism for the heavy per-layer work,
support generation especially) are all Kiri:Moto's own production build
(`https://grid.space/lib/kiri/run/{engine,worker,minion}.js`, MIT — see `LICENSE.md`), fetched and
vendored here verbatim except for patches to hardcoded relative paths that assume grid.space's own
directory layout and 404 under ours:

- `../wasm/manifold.wasm` → absolute `/vendor/kiri/manifold.wasm`, in **both** `engine.js` and
  `worker.js` (each loads the WASM independently — the worker runs in its own execution context,
  sharing no state with the main thread) — same reasoning as `locateFile` in `public/vendor/occt/`'s
  loader. `minion.js` doesn't reference manifold.wasm at all, no patch needed there.
- `engine.js`'s own default worker script path (`../lib/kiri/run/worker.js`) — not patched in the
  file itself; instead `public/kiri-slicer.js` passes `newEngine({workURL: '/vendor/kiri/worker.js'})`
  explicitly, the officially supported way to override it. Without this, the real `Worker`
  constructor fails silently (`onerror` fires, logged as `{WORKER_ERROR}`, confirmed live) and the
  whole slice hangs forever waiting for replies from a worker that was never created — no rejection
  ever surfaces, so this is easy to miss without checking the browser console specifically.
- `worker.js`'s own default **minion** pool script path (`./minion.js`, resolved against worker.js's
  own location, not engine.js's) — same fix, `newEngine({..., poolURL: '/vendor/kiri/minion.js'})`.
  Missing this doesn't hang the slice (unlike the workURL case) — it fails silently per-minion
  (`{MINION_ERROR}`) and the slice still completes, just running entirely on the single main worker
  instead of a real parallel pool. Confirmed live on a real 113k-triangle/15-part customer file: 2+
  minutes single-threaded vs ~17s with the pool actually running (grid.space's own site, same file,
  same settings: ~9s) — easy to miss because nothing errors loudly, it's just silently much slower.

All three builds bundle several other MIT-licensed open-source libraries directly (their own license
headers are preserved inside the files themselves): Three.js, ClipperLib, JSZip (+ pako), and a
Node.js `Buffer` browser polyfill (Feross Aboukhadijeh) plus `object-assign` (Sindre Sorhus).

`manifold.wasm` is a build of [Manifold](https://github.com/elalish/manifold) (mesh boolean
library), MIT-licensed, © the Manifold contributors — not part of Kiri:Moto itself, fetched
separately from `https://grid.space/wasm/manifold.wasm`.
