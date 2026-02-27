import { beforeEach, describe, expect, it } from "vitest";

import type { InboxThread, Message } from "../types";

import { useAgentChatStore } from "./agentChatStore";

const message = (partial: Partial<Message> & { id: string; clientId: string }): Message => ({
  id: partial.id,
  clientId: partial.clientId,
  threadId: partial.threadId ?? "thread-1",
  senderId: partial.senderId ?? "agent-demo",
  senderRole: partial.senderRole ?? "agent",
  body: partial.body ?? "hello",
  createdAt: partial.createdAt ?? 1,
  seq: partial.seq ?? 1,
  deliveryState: partial.deliveryState ?? "sending",
});

const inboxThread = (threadId: string): InboxThread => ({
  thread: {
    id: threadId,
    status: "open",
    createdAt: 1,
    updatedAt: 2,
  },
  unreadCount: 0,
  lastMessage: null,
});

describe("useAgentChatStore", () => {
  beforeEach(() => {
    useAgentChatStore.setState(useAgentChatStore.getInitialState(), true);
  });

  it("syncs activeThreadId from inbox when current selection is missing", () => {
    useAgentChatStore.getState().syncActiveThreadFromInbox([inboxThread("thread-a"), inboxThread("thread-b")]);
    expect(useAgentChatStore.getState().activeThreadId).toBe("thread-a");

    useAgentChatStore.getState().setActiveThreadId("missing-thread");
    useAgentChatStore.getState().syncActiveThreadFromInbox([inboxThread("thread-a"), inboxThread("thread-b")]);
    expect(useAgentChatStore.getState().activeThreadId).toBe("thread-a");
  });

  it("keeps optimistic and realtime state isolated per thread", () => {
    const optimisticA = message({ id: "optimistic-a", clientId: "c-a", threadId: "thread-a" });
    const optimisticB = message({ id: "optimistic-b", clientId: "c-b", threadId: "thread-b" });
    const realtimeA = message({
      id: "m-a",
      clientId: "c-a",
      threadId: "thread-a",
      deliveryState: "sent",
      seq: 2,
      createdAt: 2,
    });

    const store = useAgentChatStore.getState();
    store.setOptimistic("thread-a", optimisticA);
    store.setOptimistic("thread-b", optimisticB);
    store.upsertRealtimeMessage("thread-a", realtimeA);

    const state = useAgentChatStore.getState();
    expect(state.optimisticByThread["thread-a"]?.["c-a"]?.id).toBe("optimistic-a");
    expect(state.optimisticByThread["thread-b"]?.["c-b"]?.id).toBe("optimistic-b");
    expect(state.realtimeByThread["thread-a"]?.map((item) => item.id)).toEqual(["m-a"]);
    expect(state.realtimeByThread["thread-b"]).toBeUndefined();
  });

  it("reselects fallback thread or null when active thread disappears", () => {
    const store = useAgentChatStore.getState();
    store.setActiveThreadId("thread-a");

    store.syncActiveThreadFromInbox([inboxThread("thread-b")]);
    expect(useAgentChatStore.getState().activeThreadId).toBe("thread-b");

    store.syncActiveThreadFromInbox([]);
    expect(useAgentChatStore.getState().activeThreadId).toBeNull();
  });
});
