import { describe, it, expect, vi } from "vitest";
import { createDbWatchdog, RESTART_AFTER_MS, MIN_RESTART_INTERVAL_MS, type DbWatchdogDeps } from "../src/lib/server/dbWatchdog";

// The self-restart is the one part of this that acts on production on its
// own, so its rules are pinned here: only after a sustained failure, only
// when a fresh client proves a restart would help, at most once per 24h.

function setup(opts: { mainFails: boolean; freshFails?: boolean; lastRestart?: number | null }) {
  let clock = 1_000_000_000_000;
  let mainFails = opts.mainFails;
  const records: string[] = [];
  let lastRestart = opts.lastRestart ?? null;
  const deps: DbWatchdogDeps = {
    checkMain: async () => {
      if (mainFails) throw Object.assign(new Error("boom"), { name: "PrismaClientKnownRequestError", code: "P2037" });
    },
    checkFresh: async () => {
      if (opts.freshFails) throw new Error("fresh boom");
    },
    readLastRestart: async () => lastRestart,
    writeLastRestart: async (at) => {
      lastRestart = at;
    },
    record: async (line) => {
      records.push(line);
    },
    snapshot: () => "snap",
    exit: vi.fn(),
    now: () => clock,
  };
  const wd = createDbWatchdog(deps);
  return {
    deps,
    records,
    tick: () => wd.tick(),
    advance: (ms: number) => (clock += ms),
    setMainFails: (v: boolean) => (mainFails = v),
    lastRestart: () => lastRestart,
  };
}

describe("db watchdog", () => {
  it("records the first failure once, with the error code and fresh-client result", async () => {
    const t = setup({ mainFails: true });
    await t.tick();
    t.advance(30_000);
    await t.tick();
    expect(t.records).toHaveLength(1);
    expect(t.records[0]).toContain("FIRST FAILURE");
    expect(t.records[0]).toContain("code=P2037");
    expect(t.records[0]).toContain("fresh client: OK");
  });

  it("does not restart before the failure has lasted the full window", async () => {
    const t = setup({ mainFails: true });
    await t.tick();
    t.advance(RESTART_AFTER_MS - 1);
    await t.tick();
    expect(t.deps.exit).not.toHaveBeenCalled();
  });

  it("restarts once the failure has lasted the full window and a fresh client works", async () => {
    const t = setup({ mainFails: true });
    await t.tick();
    t.advance(RESTART_AFTER_MS);
    await t.tick();
    expect(t.deps.exit).toHaveBeenCalledTimes(1);
    expect(t.lastRestart()).not.toBeNull();
  });

  it("does not restart when a fresh client fails too (Postgres side, a restart would not help)", async () => {
    const t = setup({ mainFails: true, freshFails: true });
    await t.tick();
    t.advance(RESTART_AFTER_MS);
    await t.tick();
    expect(t.deps.exit).not.toHaveBeenCalled();
    expect(t.records.at(-1)).toContain("not restarting");
  });

  it("does not restart twice within 24h", async () => {
    const now = 1_000_000_000_000;
    const t = setup({ mainFails: true, lastRestart: now - 60 * 60_000 });
    await t.tick();
    t.advance(RESTART_AFTER_MS);
    await t.tick();
    expect(t.deps.exit).not.toHaveBeenCalled();
    expect(t.records.at(-1)).toContain("max 1 per 24h");
  });

  it("restarts again once the previous restart is more than 24h old", async () => {
    const now = 1_000_000_000_000;
    const t = setup({ mainFails: true, lastRestart: now - MIN_RESTART_INTERVAL_MS - 1 });
    await t.tick();
    t.advance(RESTART_AFTER_MS);
    await t.tick();
    expect(t.deps.exit).toHaveBeenCalledTimes(1);
  });

  it("a recovery resets the streak, so a later short blip does not trigger a restart", async () => {
    const t = setup({ mainFails: true });
    await t.tick();
    t.advance(RESTART_AFTER_MS - 60_000);
    t.setMainFails(false);
    await t.tick();
    expect(t.records.at(-1)).toContain("RECOVERED");
    t.setMainFails(true);
    t.advance(60_000);
    await t.tick();
    t.advance(60_000);
    await t.tick();
    expect(t.deps.exit).not.toHaveBeenCalled();
  });

  it("never logs a decision more than once per streak", async () => {
    const t = setup({ mainFails: true, freshFails: true });
    await t.tick();
    for (let i = 0; i < 20; i++) {
      t.advance(RESTART_AFTER_MS);
      await t.tick();
    }
    expect(t.records).toHaveLength(2);
  });
});
