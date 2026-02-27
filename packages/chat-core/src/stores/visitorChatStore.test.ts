import { beforeEach, describe, expect, it } from "vitest";

import type { Message, ThreadLiveMeta } from "../types";

import { useVisitorChatStore } from "./visitorChatStore";

const message = (partial: Partial<Message> & { id: string; clientId: string }): Message => ({
  id: partial.id,
  clientId: partial.clientId,
  threadId: partial.threadId ?? "thread-1",
  senderId: partial.senderId ?? "visitor-1",
  senderRole: partial.senderRole ?? "visitor",
  body: partial.body ?? "hello",
  createdAt: partial.createdAt ?? 1,
  seq: partial.seq ?? 1,
  deliveryState: partial.deliveryState ?? "sending",
});

const liveMeta = (threadId: string): ThreadLiveMeta => ({
  threadId,
  channelStatus: "SUBSCRIBED",
  online: true,
  latestHeartbeatAt: 1_000,
  participantHeartbeats: {
    "agent-demo": 1_000,
  },
});

describe("useVisitorChatStore", () => {
  beforeEach(() => {
    useVisitorChatStore.setState(useVisitorChatStore.getInitialState(), true);
  });

  it("handles optimistic state transition to failed and removes message on ack", () => {
    const optimistic = message({ id: "optimistic-c1", clientId: "c1", deliveryState: "sending" });

    useVisitorChatStore.getState().setOptimistic(optimistic);
    expect(useVisitorChatStore.getState().optimisticByClientId.c1?.deliveryState).toBe("sending");

    useVisitorChatStore.getState().markOptimisticFailed("c1", optimistic);
    expect(useVisitorChatStore.getState().optimisticByClientId.c1?.deliveryState).toBe("failed");

    useVisitorChatStore.getState().removeOptimistic("c1");
    expect(useVisitorChatStore.getState().optimisticByClientId).toEqual({});
  });

  it("resets thread-scoped state during clear conversation transition", () => {
    const optimistic = message({ id: "optimistic-c1", clientId: "c1", deliveryState: "sending" });
    const realtime = message({ id: "m1", clientId: "c1", deliveryState: "sent" });

    const store = useVisitorChatStore.getState();
    store.setThreadId("thread-1");
    store.setReady(true);
    store.setRemoteTyping(true);
    store.setOptimistic(optimistic);
    store.upsertRealtimeMessage(realtime);
    store.setLiveMeta(liveMeta("thread-1"));

    useVisitorChatStore.getState().resetForClearStart(1234);

    const afterReset = useVisitorChatStore.getState();
    expect(afterReset.threadId).toBeNull();
    expect(afterReset.ready).toBe(false);
    expect(afterReset.isClearing).toBe(true);
    expect(afterReset.lastReadAt).toBe(1234);
    expect(afterReset.remoteTyping).toBe(false);
    expect(afterReset.optimisticByClientId).toEqual({});
    expect(afterReset.realtimeMessages).toEqual([]);
    expect(afterReset.liveMeta).toBeNull();

    useVisitorChatStore.getState().restoreThreadAfterClearFailure("thread-1");
    useVisitorChatStore.getState().finalizeClear();

    const finalized = useVisitorChatStore.getState();
    expect(finalized.threadId).toBe("thread-1");
    expect(finalized.ready).toBe(true);
    expect(finalized.isClearing).toBe(false);
  });

  it("is a no-op when removing a non-existent optimistic message", () => {
    const stateBefore = useVisitorChatStore.getState();
    const optimisticRef = stateBefore.optimisticByClientId;
    const clockBefore = stateBefore.clockMs;

    useVisitorChatStore.getState().removeOptimistic("missing-client-id");

    const stateAfter = useVisitorChatStore.getState();
    expect(stateAfter.optimisticByClientId).toBe(optimisticRef);
    expect(stateAfter.clockMs).toBe(clockBefore);
  });
});
