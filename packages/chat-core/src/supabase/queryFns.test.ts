import { describe, expect, it, vi } from "vitest";

import {
  agentInboxQueryFn,
  ensureThreadMutationFn,
  markThreadReadMutationFn,
  sendMessageMutationFn,
  threadMessagesPageQueryFn,
} from "./queryFns";

describe("supabase queryFns", () => {
  it("delegates threadMessagesPageQueryFn to repository.fetchThreadPage", async () => {
    const input = {
      threadId: "thread-1",
      cursor: { createdAt: 1_000, seq: 2, id: "msg-2" },
      limit: 30,
    } as const;
    const output = {
      items: [],
      nextCursor: null,
    };
    const repository = {
      fetchThreadPage: vi.fn().mockResolvedValue(output),
    };

    await expect(threadMessagesPageQueryFn(repository, input)).resolves.toEqual(output);
    expect(repository.fetchThreadPage).toHaveBeenCalledWith(input);
  });

  it("delegates agentInboxQueryFn to repository.fetchAgentInbox", async () => {
    const input = { agentId: "agent-demo" } as const;
    const output: [] = [];
    const repository = {
      fetchAgentInbox: vi.fn().mockResolvedValue(output),
    };

    await expect(agentInboxQueryFn(repository, input)).resolves.toEqual(output);
    expect(repository.fetchAgentInbox).toHaveBeenCalledWith(input);
  });

  it("delegates ensureThreadMutationFn to repository.ensureThread", async () => {
    const input = { threadId: "thread-1", visitorId: "visitor-1", agentId: "agent-demo" } as const;
    const output = { id: "thread-1", status: "open", createdAt: 1_000, updatedAt: 2_000 } as const;
    const repository = {
      ensureThread: vi.fn().mockResolvedValue(output),
    };

    await expect(ensureThreadMutationFn(repository, input)).resolves.toEqual(output);
    expect(repository.ensureThread).toHaveBeenCalledWith(input);
  });

  it("delegates sendMessageMutationFn to repository.sendMessage", async () => {
    const input = {
      threadId: "thread-1",
      clientId: "client-1",
      senderId: "agent-demo",
      senderRole: "agent",
      body: "Hello",
      createdAt: 1_000,
    } as const;
    const output = {
      id: "msg-1",
      clientId: "client-1",
      threadId: "thread-1",
      senderId: "agent-demo",
      senderRole: "agent",
      body: "Hello",
      createdAt: 1_000,
      seq: 1,
      deliveryState: "sent",
    } as const;
    const repository = {
      sendMessage: vi.fn().mockResolvedValue(output),
    };

    await expect(sendMessageMutationFn(repository, input)).resolves.toEqual(output);
    expect(repository.sendMessage).toHaveBeenCalledWith(input);
  });

  it("delegates markThreadReadMutationFn to repository.markThreadRead", async () => {
    const input = { threadId: "thread-1", participantId: "agent-demo", at: 1_000 } as const;
    const repository = {
      markThreadRead: vi.fn().mockResolvedValue(undefined),
    };

    await expect(markThreadReadMutationFn(repository, input)).resolves.toBeUndefined();
    expect(repository.markThreadRead).toHaveBeenCalledWith(input);
  });
});
