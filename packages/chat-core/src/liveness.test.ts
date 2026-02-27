import { describe, expect, it } from "vitest";

import { createLivenessApi } from "./liveness";

describe("createLivenessApi", () => {
  it("requires subscribed channel and fresh heartbeat for service live", () => {
    const liveness = createLivenessApi("thread-1");
    const now = 1_000_000;

    liveness.setOnline(true);
    liveness.setChannelStatus("SUBSCRIBED");
    liveness.upsertHeartbeat("visitor-1", now);

    expect(liveness.isServiceLive(now + 19_999)).toBe(true);
    expect(liveness.isServiceLive(now + 20_001)).toBe(false);
  });

  it("tracks participant liveness by heartbeat TTL", () => {
    const liveness = createLivenessApi("thread-1");
    const now = 2_000_000;

    liveness.upsertHeartbeat("agent-1", now);

    expect(liveness.isParticipantLive("agent-1", now + 10_000)).toBe(true);
    expect(liveness.isParticipantLive("agent-1", now + 21_000)).toBe(false);
  });

  it("removes participant heartbeat immediately when participant leaves", () => {
    const liveness = createLivenessApi("thread-1");
    const now = 3_000_000;

    liveness.upsertHeartbeat("agent-1", now);
    expect(liveness.isParticipantLive("agent-1", now + 1_000)).toBe(true);

    liveness.removeParticipant("agent-1");
    expect(liveness.isParticipantLive("agent-1", now + 1_000)).toBe(false);
  });
});
