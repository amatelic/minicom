import React, { type PropsWithChildren } from "react";
import type { InboxThread } from "@minicom/chat-core";
import { useAgentChatStore } from "@minicom/chat-core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentInbox } from "../../hooks/useAgentInbox";

type ChannelStatus = "SUBSCRIBED" | "TIMED_OUT" | "CHANNEL_ERROR" | "CLOSED" | "JOINING";

interface MessageInsertRow {
  id: string;
  client_id: string;
  thread_id: string;
  sender_id: string;
  sender_role: "visitor" | "agent";
  body: string;
  created_at: string;
  seq: number;
}

class FakeRealtimeChannel {
  private insertHandlers: Array<(payload: { new: MessageInsertRow }) => void> = [];
  private statusHandler: ((status: ChannelStatus) => void) | null = null;

  on(
    _event: "postgres_changes",
    _filter: Record<string, unknown>,
    handler: (payload: { new: MessageInsertRow }) => void,
  ) {
    this.insertHandlers.push(handler);
    return this;
  }

  subscribe(handler: (status: ChannelStatus) => void) {
    this.statusHandler = handler;
    handler("SUBSCRIBED");
    return this;
  }

  emitInsert(row: MessageInsertRow) {
    this.insertHandlers.forEach((handler) => handler({ new: row }));
  }

  emitStatus(status: ChannelStatus) {
    this.statusHandler?.(status);
  }

  async unsubscribe() {
    return "ok";
  }
}

const { fetchAgentInboxMock, createAgentSupabaseClientMock } = vi.hoisted(() => ({
  fetchAgentInboxMock: vi.fn(),
  createAgentSupabaseClientMock: vi.fn(),
}));

vi.mock("../../lib/runtime", () => ({
  AGENT_ID: "agent-demo",
  getAgentRepository: () => ({
    fetchAgentInbox: fetchAgentInboxMock,
  }),
  createAgentSupabaseClient: () => createAgentSupabaseClientMock(),
}));

const inboxThread = (threadId: string, unreadCount: number): InboxThread => ({
  thread: {
    id: threadId,
    status: "open",
    createdAt: 1_000,
    updatedAt: 1_000,
  },
  unreadCount,
  lastMessage: null,
});

const setVisibilityState = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

const createWrapper = (queryClient: QueryClient) => {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  Wrapper.displayName = "AgentInboxTestWrapper";
  return Wrapper;
};

describe("useAgentInbox", () => {
  let channel: FakeRealtimeChannel;

  beforeEach(() => {
    useAgentChatStore.setState(useAgentChatStore.getInitialState(), true);
    fetchAgentInboxMock.mockReset();
    createAgentSupabaseClientMock.mockReset();

    setVisibilityState("visible");
    channel = new FakeRealtimeChannel();
    createAgentSupabaseClientMock.mockReturnValue({
      channel: vi.fn(() => channel),
    });
    fetchAgentInboxMock.mockResolvedValue([inboxThread("thread-1", 0)]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies realtime insert using cache patch without immediate refetch", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const { result } = renderHook(() => useAgentInbox(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(fetchAgentInboxMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.activeThreadId).toBe("thread-1");
    });

    act(() => {
      channel.emitInsert({
        id: "msg-2",
        client_id: "client-2",
        thread_id: "thread-1",
        sender_id: "visitor-1",
        sender_role: "visitor",
        body: "hello from visitor",
        created_at: new Date(2_000).toISOString(),
        seq: 2,
      });
    });

    await waitFor(() => {
      expect(result.current.inbox[0]?.lastMessage?.body).toBe("hello from visitor");
    });
    expect(result.current.inbox[0]?.unreadCount).toBe(0);
    expect(fetchAgentInboxMock).toHaveBeenCalledTimes(1);

    act(() => {
      channel.emitInsert({
        id: "msg-2-dup",
        client_id: "client-2",
        thread_id: "thread-1",
        sender_id: "visitor-1",
        sender_role: "visitor",
        body: "hello from visitor",
        created_at: new Date(2_000).toISOString(),
        seq: 2,
      });
    });

    expect(result.current.inbox[0]?.unreadCount).toBe(0);
    expect(fetchAgentInboxMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to 60s polling when realtime channel is healthy and tab is visible", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    renderHook(() => useAgentInbox(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(fetchAgentInboxMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      vi.advanceTimersByTime(59_000);
    });
    expect(fetchAgentInboxMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    await waitFor(() => {
      expect(fetchAgentInboxMock).toHaveBeenCalledTimes(2);
    });
  }, 10000);

  it("switches to 10s polling on degraded channel and disables polling when tab is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    renderHook(() => useAgentInbox(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(fetchAgentInboxMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      channel.emitStatus("CHANNEL_ERROR");
    });

    await act(async () => {
      vi.advanceTimersByTime(11_000);
    });
    await waitFor(() => {
      expect(fetchAgentInboxMock).toHaveBeenCalledTimes(2);
    });

    setVisibilityState("hidden");

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(fetchAgentInboxMock).toHaveBeenCalledTimes(2);
  }, 10000);
});
