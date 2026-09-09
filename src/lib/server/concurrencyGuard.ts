import { ServerBusyError } from "../api/errors";

// A tiny in-process weighted "bulkhead" for POST /api/quotes (see
// quotes/index.ts): bounds how much aggregate memory-heavy work can run at
// once, weighted by an estimated cost per request rather than a flat
// concurrent-request count — a 1MB file and a 150MB file don't cost the same,
// so a flat "max N concurrent" would either starve small requests or let too
// many large ones stack up. In-memory, single-process only — same assumption
// as rateLimit.ts (this deploy target is one long-lived Node process, no
// horizontal scaling; see docker-compose.yml, one `api` service, no replicas).
//
// A waiting request holds essentially nothing (a Promise + a timer), so a
// generous queue depth is cheap — see quotes/index.ts's own comment on why
// this gate is acquired *before* reading the request body: that's what keeps
// a queued request's memory footprint near zero while it waits.
class WeightedGate {
  private used = 0;
  private readonly queue: { weight: number; grant: () => void; timer: ReturnType<typeof setTimeout> }[] = [];

  constructor(
    private readonly capacityUnits: number,
    private readonly maxQueue: number,
    private readonly waitTimeoutMs: number,
  ) {}

  async acquire(weight: number): Promise<() => void> {
    if (this.queue.length === 0 && this.used + weight <= this.capacityUnits) {
      this.used += weight;
      return this.releaseOnce(weight);
    }
    if (this.queue.length >= this.maxQueue) {
      throw new ServerBusyError();
    }
    await new Promise<void>((resolve, reject) => {
      const entry = {
        weight,
        grant: () => resolve(),
        timer: setTimeout(() => {
          const idx = this.queue.indexOf(entry);
          if (idx !== -1) this.queue.splice(idx, 1);
          reject(new ServerBusyError());
        }, this.waitTimeoutMs),
      };
      this.queue.push(entry);
    });
    // drain() already added `weight` to `used` before granting this waiter
    // (see below) — adding it again here would double-count every queued
    // admission, permanently overcounting `used` by one weight's worth per
    // request that had to wait (a real bug caught live: two small, totally
    // independent 2-request bursts got stuck at 503 for a full wait-timeout
    // right after a heavier burst, even though real usage had long since
    // dropped — traced to exactly this double-add).
    return this.releaseOnce(weight);
  }

  // The returned closure is idempotent on purpose: quotes/index.ts pairs it
  // with an independent last-resort timer (separate from this gate's own
  // wait timeout above) in case the underlying request's own promise chain
  // never settles at all — calling release twice must never double-subtract.
  private releaseOnce(weight: number): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.used -= weight;
      this.drain();
    };
  }

  private drain() {
    while (this.queue.length > 0 && this.used + this.queue[0].weight <= this.capacityUnits) {
      const entry = this.queue.shift()!;
      clearTimeout(entry.timer);
      this.used += entry.weight;
      entry.grant();
    }
  }
}

// Derived from this session's own measurement: checkManifoldAndParts alone
// measured 136.5MB on a ~1.1M-triangle file, and the full request path
// (raw buffer + parsed + transformed + re-transformed + serialized copies,
// see quotes/index.ts) roughly quadruples the incoming Content-Length at the
// 150MB/1.5M-triangle ceiling (~600MB observed order of magnitude). Treat
// these as a reasoned starting point, not a calibrated final answer — see
// the plan's verification section (real concurrent-load test with
// docker events, same method used to size MAX_QUOTE_TRIANGLES).
const WEIGHT_MULTIPLIER = 4;
const WEIGHT_FLOOR_MB = 15;
// Mirrors quotes/index.ts's own MAX_FILE_BYTES (150MB) — used only as the
// conservative fallback weight when Content-Length is missing/unparseable.
// Kept as a separate literal rather than imported, same convention as this
// file's other duplicated guards (see quotes/index.ts's own comment on why).
const WORST_CASE_FILE_MB = 150;

const UPLOAD_GATE_CAPACITY_MB = 1024;
const UPLOAD_GATE_MAX_QUEUE = 30;
const UPLOAD_GATE_WAIT_TIMEOUT_MS = 20_000;
const uploadGate = new WeightedGate(UPLOAD_GATE_CAPACITY_MB, UPLOAD_GATE_MAX_QUEUE, UPLOAD_GATE_WAIT_TIMEOUT_MS);

export function estimateUploadWeightMB(contentLengthBytes: number | null): number {
  if (contentLengthBytes === null || !Number.isFinite(contentLengthBytes) || contentLengthBytes <= 0) {
    return WORST_CASE_FILE_MB * WEIGHT_MULTIPLIER;
  }
  return Math.max(WEIGHT_FLOOR_MB, (contentLengthBytes / (1024 * 1024)) * WEIGHT_MULTIPLIER);
}

export function acquireUploadSlot(weightMB: number): Promise<() => void> {
  return uploadGate.acquire(weightMB);
}

// Separate, stricter, near-exclusive lock specifically around sliceModel()'s
// real child-process slice (kiriSlicer.ts) — the highest, least-bounded risk
// (a real OOM from this exact subprocess is already documented in
// kiriSlicer.ts), and rare (only when the visitor's own browser slice is
// missing or fails validateClaimedSlice). Unweighted: capacity 1 means at
// most one such subprocess runs at a time, container-wide. Short wait
// timeout on purpose — if the one slot is busy, waiting long doesn't help
// (the in-progress subprocess can itself run up to 300s, see kiriSlicer.ts),
// so fail fast to a clean error instead of holding a scarce general-gate
// slot for a long time.
const FALLBACK_SLICE_WAIT_TIMEOUT_MS = 15_000;
const FALLBACK_SLICE_MAX_QUEUE = 3;
const fallbackSliceGate = new WeightedGate(1, FALLBACK_SLICE_MAX_QUEUE, FALLBACK_SLICE_WAIT_TIMEOUT_MS);

export function acquireFallbackSliceSlot(): Promise<() => void> {
  return fallbackSliceGate.acquire(1);
}
