"use client";

import {
  applyMessageToInbox,
  agentInboxKey,
  agentInboxQueryFn,
  type InboxThread,
  type Message,
  type RealtimeChannelStatus,
  useAgentChatStoreSlice,
} from "@minicom/chat-core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AGENT_ID, createAgentSupabaseClient, getAgentRepository } from "@/lib/runtime";

const HEALTHY_POLL_INTERVAL_MS = 60_000;
const DEGRADED_POLL_INTERVAL_MS = 10_000;
const UNKNOWN_THREAD_INVALIDATE_THROTTLE_MS = 5_000;
const SEEN_EVENT_TTL_MS = 60_000;

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

const normalizeChannelStatus = (status: string): RealtimeChannelStatus => {
  if (status === "SUBSCRIBED") {
    return "SUBSCRIBED";
  }

  if (status === "TIMED_OUT") {
    return "TIMED_OUT";
  }

  if (status === "CHANNEL_ERROR") {
    return "CHANNEL_ERROR";
  }

  if (status === "CLOSED") {
    return "CLOSED";
  }

  return "JOINING";
};

const isDocumentVisible = (): boolean => {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
};

const toMessage = (input: MessageInsertRow): Message => ({
  id: input.id,
  clientId: input.client_id,
  threadId: input.thread_id,
  senderId: input.sender_id,
  senderRole: input.sender_role,
  body: input.body,
  createdAt: new Date(input.created_at).getTime(),
  seq: input.seq,
  deliveryState: "sent",
});

export interface UseAgentInboxResult {
  inbox: InboxThread[];
  activeThreadId: string | null;
  setActiveThreadId: (threadId: string | null) => void;
  isLoading: boolean;
}

export const useAgentInbox = (): UseAgentInboxResult => {
  const queryClient = useQueryClient();
  const repository = useMemo(() => getAgentRepository(), []);
  const supabase = useMemo(() => createAgentSupabaseClient(), []);
  const { activeThreadId, setActiveThreadId, syncActiveThreadFromInbox } = useAgentChatStoreSlice();
  const activeThreadIdRef = useRef(activeThreadId);
  const seenMessageKeysRef = useRef<Map<string, number>>(new Map());
  const lastUnknownInvalidateAtRef = useRef(0);
  const [isPageVisible, setIsPageVisible] = useState(isDocumentVisible);
  const [inboxChannelStatus, setInboxChannelStatus] = useState<RealtimeChannelStatus>("JOINING");

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncVisibility = () => {
      setIsPageVisible(isDocumentVisible());
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  const invalidateUnknownThreads = useCallback(() => {
    const now = Date.now();
    if (now - lastUnknownInvalidateAtRef.current < UNKNOWN_THREAD_INVALIDATE_THROTTLE_MS) {
      return;
    }

    lastUnknownInvalidateAtRef.current = now;
    void queryClient.invalidateQueries({ queryKey: agentInboxKey });
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase.channel(`agent-inbox:${AGENT_ID}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
        const next = payload.new as unknown as MessageInsertRow | null;
        if (!next) {
          return;
        }

        if (
          !next.id ||
          !next.client_id ||
          !next.thread_id ||
          !next.sender_id ||
          !next.sender_role ||
          !next.body ||
          !next.created_at
        ) {
          return;
        }

        const dedupeKey = `${next.thread_id}:${next.client_id}`;
        const now = Date.now();
        const seenMessageKeys = seenMessageKeysRef.current;
        seenMessageKeys.forEach((seenAt, key) => {
          if (now - seenAt > SEEN_EVENT_TTL_MS) {
            seenMessageKeys.delete(key);
          }
        });

        const alreadySeenAt = seenMessageKeys.get(dedupeKey);
        if (alreadySeenAt && now - alreadySeenAt <= SEEN_EVENT_TTL_MS) {
          return;
        }
        seenMessageKeys.set(dedupeKey, now);

        const incomingMessage = toMessage(next);
        let insertedUnknownThread = false;

        queryClient.setQueryData<InboxThread[] | undefined>(agentInboxKey, (current) => {
          const result = applyMessageToInbox(current, incomingMessage, {
            agentId: AGENT_ID,
            activeThreadId: activeThreadIdRef.current,
          });

          insertedUnknownThread = result.insertedUnknownThread;
          return result.items;
        });

        if (insertedUnknownThread) {
          invalidateUnknownThreads();
        }
      },
    );

    channel.subscribe(
      (status: "SUBSCRIBED" | "TIMED_OUT" | "CHANNEL_ERROR" | "CLOSED" | "JOINING") => {
        setInboxChannelStatus(normalizeChannelStatus(status));
      },
    );

    return () => {
      setInboxChannelStatus("CLOSED");
      void channel.unsubscribe();
    };
  }, [invalidateUnknownThreads, queryClient, supabase]);

  const inboxQuery = useQuery({
    queryKey: agentInboxKey,
    queryFn: async () => {
      return agentInboxQueryFn(repository, { agentId: AGENT_ID });
    },
    refetchInterval: () => {
      if (!isPageVisible) {
        return false;
      }

      return inboxChannelStatus === "SUBSCRIBED"
        ? HEALTHY_POLL_INTERVAL_MS
        : DEGRADED_POLL_INTERVAL_MS;
    },
  });

  const inbox = useMemo(() => inboxQuery.data ?? [], [inboxQuery.data]);

  useEffect(() => {
    syncActiveThreadFromInbox(inbox);
  }, [inbox, syncActiveThreadFromInbox]);

  return {
    inbox,
    activeThreadId,
    setActiveThreadId,
    isLoading: inboxQuery.isLoading,
  };
};
