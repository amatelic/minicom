import { describe, expect, it } from "vitest";

import type { InboxThread, Message } from "../types";

import { applyMessageToInbox } from "./inbox";

const message = (partial: Partial<Message> & { id: string; clientId: string; threadId: string }): Message => ({
  id: partial.id,
  clientId: partial.clientId,
  threadId: partial.threadId,
  senderId: partial.senderId ?? "visitor-1",
  senderRole: partial.senderRole ?? "visitor",
  body: partial.body ?? "hello",
  createdAt: partial.createdAt ?? 1,
  seq: partial.seq ?? 1,
  deliveryState: partial.deliveryState ?? "sent",
});

const inboxItem = (
  threadId: string,
  input: { unreadCount: number; updatedAt: number; createdAt?: number; lastMessage?: Message | null },
): InboxThread => ({
  thread: {
    id: threadId,
    status: "open",
    createdAt: input.createdAt ?? input.updatedAt,
    updatedAt: input.updatedAt,
  },
  unreadCount: input.unreadCount,
  lastMessage: input.lastMessage ?? null,
});

describe("applyMessageToInbox", () => {
  it("increments unread for inactive thread on inbound visitor message", () => {
    const incoming = message({
      id: "m1",
      clientId: "c1",
      threadId: "thread-1",
      senderId: "visitor-1",
      body: "new inbound",
      createdAt: 200,
    });
    const current = [inboxItem("thread-1", { unreadCount: 2, updatedAt: 100 })];

    const next = applyMessageToInbox(current, incoming, {
      agentId: "agent-demo",
      activeThreadId: "thread-2",
    });

    expect(next.insertedUnknownThread).toBe(false);
    expect(next.items[0]?.unreadCount).toBe(3);
    expect(next.items[0]?.lastMessage?.id).toBe("m1");
    expect(next.items[0]?.thread.updatedAt).toBe(200);
  });

  it("keeps unread at zero for active thread on inbound visitor message", () => {
    const incoming = message({
      id: "m2",
      clientId: "c2",
      threadId: "thread-1",
      senderId: "visitor-1",
      createdAt: 220,
    });
    const current = [inboxItem("thread-1", { unreadCount: 0, updatedAt: 100 })];

    const next = applyMessageToInbox(current, incoming, {
      agentId: "agent-demo",
      activeThreadId: "thread-1",
    });

    expect(next.items[0]?.unreadCount).toBe(0);
    expect(next.items[0]?.lastMessage?.id).toBe("m2");
  });

  it("does not increment unread for outbound agent message", () => {
    const outgoing = message({
      id: "m3",
      clientId: "c3",
      threadId: "thread-1",
      senderId: "agent-demo",
      senderRole: "agent",
      createdAt: 240,
    });
    const current = [inboxItem("thread-1", { unreadCount: 4, updatedAt: 100 })];

    const next = applyMessageToInbox(current, outgoing, {
      agentId: "agent-demo",
      activeThreadId: "thread-1",
    });

    expect(next.items[0]?.unreadCount).toBe(4);
    expect(next.items[0]?.thread.updatedAt).toBe(240);
  });

  it("inserts unknown thread placeholder and flags background hydration", () => {
    const incoming = message({
      id: "m4",
      clientId: "c4",
      threadId: "thread-new",
      senderId: "visitor-1",
      createdAt: 300,
    });

    const next = applyMessageToInbox([], incoming, {
      agentId: "agent-demo",
      activeThreadId: null,
    });

    expect(next.insertedUnknownThread).toBe(true);
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.thread.id).toBe("thread-new");
    expect(next.items[0]?.thread.status).toBe("open");
    expect(next.items[0]?.unreadCount).toBe(1);
  });

  it("keeps sort order by unread then updatedAt after patching", () => {
    const current = [
      inboxItem("thread-a", { unreadCount: 1, updatedAt: 100 }),
      inboxItem("thread-b", { unreadCount: 2, updatedAt: 90 }),
    ];
    const incoming = message({
      id: "m5",
      clientId: "c5",
      threadId: "thread-a",
      senderId: "visitor-1",
      createdAt: 250,
    });

    const next = applyMessageToInbox(current, incoming, {
      agentId: "agent-demo",
      activeThreadId: null,
    });

    expect(next.items.map((item) => item.thread.id)).toEqual(["thread-a", "thread-b"]);
    expect(next.items[0]?.unreadCount).toBe(2);
  });
});
