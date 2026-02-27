"use client";

import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TTL_MS,
  agentInboxKey,
  type InboxThread,
  type Message,
  type ThreadLiveMeta,
  createLivenessApi,
  flattenPages,
  markThreadReadMutationFn,
  mergeMessages,
  sendMessageMutationFn,
  threadLiveMetaKey,
  threadMessagesKey,
  threadMessagesPageQueryFn,
  useAgentChatStoreSlice,
  useTypingSignal,
  validateMessageBody,
} from "@minicom/chat-core";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { AGENT_ID, createAgentGateway, getAgentRepository } from "@/lib/runtime";

const PAGE_LIMIT = 30;
const LIVE_META_STALE_TIME_MS = 10_000;
const LIVE_META_GC_TIME_MS = 5 * 60_000;

const createId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const makeOptimisticMessage = (input: {
  clientId: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: number;
  deliveryState: Message["deliveryState"];
}): Message => {
  return {
    id: `optimistic-${input.clientId}`,
    clientId: input.clientId,
    threadId: input.threadId,
    senderId: input.senderId,
    senderRole: "agent",
    body: input.body,
    createdAt: input.createdAt,
    seq: input.createdAt,
    deliveryState: input.deliveryState,
  };
};

const createLiveMetaFallback = (threadId: string): ThreadLiveMeta => ({
  threadId,
  channelStatus: "CLOSED" as const,
  online: true,
  latestHeartbeatAt: null,
  participantHeartbeats: {},
});

export interface UseAgentThreadResult {
  messages: Message[];
  hasOlder: boolean;
  isFetchingOlder: boolean;
  isSending: boolean;
  isVisitorTyping: boolean;
  isServiceLive: boolean;
  isVisitorLive: boolean;
  sendMessage: (value: string) => Promise<void>;
  retryMessage: (clientId: string) => Promise<void>;
  onTypingInputChange: (value: string) => void;
  stopTyping: () => void;
  loadOlder: () => Promise<void>;
}

export const useAgentThread = (threadId: string | null): UseAgentThreadResult => {
  const queryClient = useQueryClient();

  const repository = useMemo(() => getAgentRepository(), []);
  const gatewayRef = useRef<ReturnType<typeof createAgentGateway> | null>(null);
  const livenessRef = useRef<ReturnType<typeof createLivenessApi> | null>(null);

  const {
    clockMs,
    remoteTypingByThread,
    optimisticByThread,
    realtimeByThread,
    liveMetaByThread,
    setRemoteTyping,
    upsertRealtimeMessage,
    setOptimistic,
    removeOptimistic,
    markOptimisticFailed,
    setLiveMeta,
    setClockMs,
  } = useAgentChatStoreSlice();

  const lastMarkedReadAtRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockMs(Date.now());
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, [setClockMs]);

  const liveMetaQuery = useQuery({
    queryKey: threadId ? threadLiveMetaKey(threadId) : ["thread-live-meta", "idle-agent"],
    enabled: Boolean(threadId),
    queryFn: async () => {
      if (!threadId) {
        return createLiveMetaFallback("idle-agent");
      }

      return livenessRef.current?.snapshot() ?? createLiveMetaFallback(threadId);
    },
    staleTime: LIVE_META_STALE_TIME_MS,
    gcTime: LIVE_META_GC_TIME_MS,
  });

  const bumpLiveMeta = useCallback(() => {
    if (!threadId || !livenessRef.current) {
      return;
    }

    const snapshot = livenessRef.current.snapshot();
    queryClient.setQueryData(threadLiveMetaKey(threadId), snapshot);
    setLiveMeta(threadId, snapshot);
  }, [queryClient, setLiveMeta, threadId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (input: {
      threadId: string;
      clientId: string;
      senderId: string;
      senderRole: "visitor" | "agent";
      body: string;
      createdAt: number;
    }) => {
      return sendMessageMutationFn(repository, input);
    },
  });

  const markThreadReadMutation = useMutation({
    mutationFn: async (input: { threadId: string; participantId: string; at: number }) => {
      return markThreadReadMutationFn(repository, input);
    },
  });

  const sendMessageToThread = sendMessageMutation.mutateAsync;
  const markThreadRead = markThreadReadMutation.mutate;

  const markThreadAsRead = useCallback(
    (at: number) => {
      if (!threadId) {
        return;
      }

      const readAt = Math.max(at, Date.now());
      if (readAt <= lastMarkedReadAtRef.current) {
        return;
      }

      lastMarkedReadAtRef.current = readAt;

      queryClient.setQueryData<InboxThread[] | undefined>(agentInboxKey, (current) => {
        if (!current) {
          return current;
        }

        return current.map((item) =>
          item.thread.id === threadId
            ? {
                ...item,
                unreadCount: 0,
              }
            : item,
        );
      });

      markThreadRead({
        threadId,
        participantId: AGENT_ID,
        at: readAt,
      });
    },
    [markThreadRead, queryClient, threadId],
  );

  useEffect(() => {
    lastMarkedReadAtRef.current = 0;
  }, [threadId]);

  useEffect(() => {
    if (!threadId) {
      return;
    }

    const liveness = createLivenessApi(threadId);
    liveness.setOnline(window.navigator.onLine);
    livenessRef.current = liveness;
    bumpLiveMeta();

    const gateway = createAgentGateway();
    gatewayRef.current = gateway;

    const unsubscribe = gateway.subscribe((event) => {
      if (event.type === "message.inserted" && event.threadId === threadId) {
        upsertRealtimeMessage(event.threadId, event.message);
        removeOptimistic(event.threadId, event.message.clientId);

        if (event.message.senderId !== AGENT_ID) {
          markThreadAsRead(event.message.createdAt);
        }
      }

      if (event.type === "typing.updated" && event.payload.threadId === threadId) {
        if (event.payload.participantId === AGENT_ID) {
          return;
        }

        setRemoteTyping(threadId, event.payload.isTyping);
      }

      if (event.type === "heartbeat" && event.payload.threadId === threadId) {
        liveness.upsertHeartbeat(event.payload.participantId, event.payload.at);
        bumpLiveMeta();
      }

      if (event.type === "presence.sync" && event.threadId === threadId) {
        const activeParticipants = new Set(event.participantIds);
        const knownParticipants = Object.keys(liveness.snapshot().participantHeartbeats);
        knownParticipants.forEach((participantId) => {
          if (!activeParticipants.has(participantId)) {
            liveness.removeParticipant(participantId);
          }
        });
        bumpLiveMeta();
      }

      if (event.type === "channel.status" && event.threadId === threadId) {
        liveness.setChannelStatus(event.status);
        bumpLiveMeta();
      }
    });

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const publishHeartbeat = async () => {
      if (!gatewayRef.current || !livenessRef.current) {
        return;
      }

      const at = Date.now();
      livenessRef.current.upsertHeartbeat(AGENT_ID, at);
      bumpLiveMeta();

      await gatewayRef.current.publishHeartbeat({
        threadId,
        participantId: AGENT_ID,
        at,
      });
    };

    void gateway.connectThread(threadId).then(async () => {
      await publishHeartbeat();
      heartbeatTimer = setInterval(() => {
        void publishHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
    });

    const syncOnline = () => {
      liveness.setOnline(window.navigator.onLine);
      bumpLiveMeta();
    };

    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);

    markThreadAsRead(Date.now());

    return () => {
      unsubscribe();
      setRemoteTyping(threadId, false);
      setLiveMeta(threadId, null);
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      void gateway.disconnect();
    };
  }, [
    bumpLiveMeta,
    markThreadAsRead,
    removeOptimistic,
    setLiveMeta,
    setRemoteTyping,
    threadId,
    upsertRealtimeMessage,
  ]);

  const messagesQuery = useInfiniteQuery({
    queryKey: threadId ? threadMessagesKey(threadId) : ["thread-messages", "idle-agent"],
    enabled: Boolean(threadId),
    initialPageParam: null as { createdAt: number; seq: number; id: string } | null,
    queryFn: async ({ pageParam }) => {
      return threadMessagesPageQueryFn(repository, {
        threadId: threadId!,
        cursor: pageParam,
        limit: PAGE_LIMIT,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const pagedMessages = useMemo(() => {
    if (!messagesQuery.data) {
      return [];
    }

    return flattenPages(messagesQuery.data.pages);
  }, [messagesQuery.data]);

  const currentRealtimeMessages = useMemo(() => {
    if (!threadId) {
      return [];
    }

    return realtimeByThread[threadId] ?? [];
  }, [realtimeByThread, threadId]);

  const currentOptimisticMessages = useMemo(() => {
    if (!threadId) {
      return [];
    }

    return Object.values(optimisticByThread[threadId] ?? {});
  }, [optimisticByThread, threadId]);

  const messages = useMemo(() => {
    return mergeMessages(pagedMessages, currentRealtimeMessages, currentOptimisticMessages);
  }, [currentOptimisticMessages, currentRealtimeMessages, pagedMessages]);

  const latestVisitorMessageAt = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message && message.senderId !== AGENT_ID) {
        return message.createdAt;
      }
    }

    return null;
  }, [messages]);

  useEffect(() => {
    if (!threadId || !latestVisitorMessageAt) {
      return;
    }

    markThreadAsRead(latestVisitorMessageAt);
  }, [latestVisitorMessageAt, markThreadAsRead, threadId]);

  const resolvedLiveMeta =
    (threadId ? liveMetaByThread[threadId] : null) ?? liveMetaQuery.data ?? null;

  const isServiceLive = useMemo(() => {
    if (!resolvedLiveMeta?.latestHeartbeatAt) {
      return false;
    }

    return (
      resolvedLiveMeta.online &&
      resolvedLiveMeta.channelStatus === "SUBSCRIBED" &&
      clockMs - resolvedLiveMeta.latestHeartbeatAt <= HEARTBEAT_TTL_MS
    );
  }, [clockMs, resolvedLiveMeta]);

  const visitorHeartbeat = resolvedLiveMeta?.participantHeartbeats
    ? Object.entries(resolvedLiveMeta.participantHeartbeats).find(
        ([participantId]) => participantId !== AGENT_ID,
      )?.[1]
    : null;

  const isVisitorLive = Boolean(visitorHeartbeat && clockMs - visitorHeartbeat <= HEARTBEAT_TTL_MS);

  const canEmitTyping = Boolean(
    threadId && resolvedLiveMeta?.online && resolvedLiveMeta.channelStatus === "SUBSCRIBED",
  );
  const canSendMessages =
    threadId &&
    resolvedLiveMeta?.online &&
    resolvedLiveMeta.channelStatus === "SUBSCRIBED" &&
    window?.navigator.onLine;

  const { onInputChange, forceStop } = useTypingSignal({
    threadId,
    participantId: AGENT_ID,
    canEmit: canEmitTyping,
    publish: async (payload) => {
      if (!gatewayRef.current || !threadId) {
        return;
      }

      await gatewayRef.current.setTyping({
        threadId,
        participantId: AGENT_ID,
        isTyping: payload.isTyping,
        at: Date.now(),
      });
    },
  });

  const sendInternal = useCallback(
    async (body: string, existingClientId?: string) => {
      const targetThreadId = threadId;
      if (!targetThreadId) {
        return;
      }

      const validation = validateMessageBody(body);
      if (!validation.isValid) {
        return;
      }

      const safeBody = validation.value;

      const createdAt = Date.now();
      const clientId = existingClientId ?? createId("client");
      const optimistic = makeOptimisticMessage({
        clientId,
        threadId: targetThreadId,
        senderId: AGENT_ID,
        body: safeBody,
        createdAt,
        deliveryState: "sending",
      });

      setOptimistic(targetThreadId, optimistic);
      if (!canSendMessages) {
        markOptimisticFailed(targetThreadId, clientId, optimistic);
        return;
      }

      try {
        const message = await sendMessageToThread({
          threadId: targetThreadId,
          clientId,
          senderId: AGENT_ID,
          senderRole: "agent",
          body: safeBody,
          createdAt,
        });

        upsertRealtimeMessage(targetThreadId, message);
        removeOptimistic(targetThreadId, clientId);

        await gatewayRef.current?.sendMessage({ threadId: targetThreadId, message });
      } catch {
        markOptimisticFailed(targetThreadId, clientId, optimistic);
      }
    },
    [
      canSendMessages,
      markOptimisticFailed,
      removeOptimistic,
      sendMessageToThread,
      setOptimistic,
      threadId,
      upsertRealtimeMessage,
    ],
  );

  const sendMessage = useCallback(
    async (value: string) => {
      await sendInternal(value);
      forceStop();
    },
    [forceStop, sendInternal],
  );

  const retryMessage = useCallback(
    async (clientId: string) => {
      if (!threadId) {
        return;
      }

      const failed = (optimisticByThread[threadId] ?? {})[clientId];
      if (!failed || failed.deliveryState !== "failed") {
        return;
      }

      await sendInternal(failed.body, clientId);
    },
    [optimisticByThread, sendInternal, threadId],
  );

  const loadOlder = useCallback(async () => {
    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) {
      return;
    }

    await messagesQuery.fetchNextPage();
  }, [messagesQuery]);

  return {
    messages,
    hasOlder: Boolean(messagesQuery.hasNextPage),
    isFetchingOlder: messagesQuery.isFetchingNextPage,
    isSending: sendMessageMutation.isPending,
    isVisitorTyping: threadId ? (remoteTypingByThread[threadId] ?? false) : false,
    isServiceLive,
    isVisitorLive,
    sendMessage,
    retryMessage,
    onTypingInputChange: onInputChange,
    stopTyping: forceStop,
    loadOlder,
  };
};
