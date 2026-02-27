"use client";

import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TTL_MS,
  type Message,
  type ThreadLiveMeta,
  SupabaseMessageRepository,
  SupabaseRealtimeGateway,
  createLivenessApi,
  createSupabaseBrowserClient,
  ensureThreadMutationFn,
  flattenPages,
  markThreadReadMutationFn,
  mergeMessages,
  sendMessageMutationFn,
  threadLiveMetaKey,
  threadMessagesKey,
  threadMessagesPageQueryFn,
  useTypingSignal,
  useVisitorChatStoreSlice,
  validateMessageBody,
} from "@minicom/chat-core";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { createId, readOrCreateSessionId } from "../lib/ids";

import { useVisitorTabLock } from "./useVisitorTabLock";

const AGENT_ID = "agent-demo";
const VISITOR_STORAGE_KEY = "minicom:visitor-id";
const THREAD_STORAGE_KEY = "minicom:thread-id";
const PAGE_LIMIT = 30;
const LIVE_META_STALE_TIME_MS = 10_000;
const LIVE_META_GC_TIME_MS = 5 * 60_000;

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
    senderRole: "visitor",
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

export interface UseVisitorChatResult {
  ready: boolean;
  isPrimaryTab: boolean;
  threadId: string | null;
  messages: Message[];
  hasOlder: boolean;
  isFetchingOlder: boolean;
  isSending: boolean;
  isClearing: boolean;
  unreadCount: number;
  isAgentTyping: boolean;
  isServiceLive: boolean;
  isAgentLive: boolean;
  sendMessage: (value: string) => Promise<void>;
  retryMessage: (clientId: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  onTypingInputChange: (value: string) => void;
  stopTyping: () => void;
  loadOlder: () => Promise<void>;
  markVisitorRead: () => Promise<void>;
}

export const useVisitorChat = ({ widgetOpen }: { widgetOpen: boolean }): UseVisitorChatResult => {
  const queryClient = useQueryClient();
  const { isPrimaryTab, lockReady } = useVisitorTabLock();
  const canOwnChat = lockReady && isPrimaryTab;

  const {
    visitorId,
    threadId,
    ready,
    isClearing,
    remoteTyping,
    lastReadAt,
    clockMs,
    optimisticByClientId,
    realtimeMessages,
    liveMeta,
    setVisitorId,
    setThreadId,
    setReady,
    setRemoteTyping,
    upsertRealtimeMessage,
    resetRealtimeForThread,
    setOptimistic,
    removeOptimistic,
    markOptimisticFailed,
    setLiveMeta,
    setClockMs,
    setLastReadAt,
    resetForClearStart,
    restoreThreadAfterClearFailure,
    finalizeClear,
  } = useVisitorChatStoreSlice();

  const repositoryRef = useRef<SupabaseMessageRepository | null>(null);
  const gatewayRef = useRef<SupabaseRealtimeGateway | null>(null);
  const livenessRef = useRef<ReturnType<typeof createLivenessApi> | null>(null);

  useEffect(() => {
    setVisitorId(readOrCreateSessionId(VISITOR_STORAGE_KEY, "visitor"));
  }, [setVisitorId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClockMs(Date.now());
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, [setClockMs]);

  useEffect(() => {
    if (!visitorId) {
      return;
    }

    if (repositoryRef.current && gatewayRef.current) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    repositoryRef.current = new SupabaseMessageRepository(supabase);
    gatewayRef.current = new SupabaseRealtimeGateway(supabase, visitorId);
  }, [visitorId]);

  const ensureThreadMutation = useMutation({
    mutationFn: async (input: { threadId?: string; visitorId: string; agentId: string }) => {
      if (!repositoryRef.current) {
        throw new Error("Visitor repository is not initialized.");
      }

      return ensureThreadMutationFn(repositoryRef.current, input);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (input: {
      threadId: string;
      clientId: string;
      senderId: string;
      senderRole: "visitor" | "agent";
      body: string;
      createdAt: number;
    }) => {
      if (!repositoryRef.current) {
        throw new Error("Visitor repository is not initialized.");
      }

      return sendMessageMutationFn(repositoryRef.current, input);
    },
  });

  const markThreadReadMutation = useMutation({
    mutationFn: async (input: { threadId: string; participantId: string; at: number }) => {
      if (!repositoryRef.current) {
        throw new Error("Visitor repository is not initialized.");
      }

      return markThreadReadMutationFn(repositoryRef.current, input);
    },
  });

  const ensureThread = ensureThreadMutation.mutateAsync;
  const sendMessageToThread = sendMessageMutation.mutateAsync;
  const markThreadRead = markThreadReadMutation.mutateAsync;

  useEffect(() => {
    if (!visitorId || !repositoryRef.current) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      const savedThreadId =
        typeof window !== "undefined" ? window.localStorage.getItem(THREAD_STORAGE_KEY) ?? undefined : undefined;
      const thread = await ensureThread({
        threadId: savedThreadId,
        visitorId,
        agentId: AGENT_ID,
      });

      if (cancelled) {
        return;
      }

      setThreadId(thread.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THREAD_STORAGE_KEY, thread.id);
      }
      setReady(true);
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [ensureThread, setReady, setThreadId, visitorId]);

  const liveMetaQuery = useQuery({
    queryKey: threadId ? threadLiveMetaKey(threadId) : ["thread-live-meta", "idle"],
    enabled: Boolean(threadId),
    queryFn: async () => {
      if (!threadId) {
        return createLiveMetaFallback("idle");
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
    setLiveMeta(snapshot);
  }, [queryClient, setLiveMeta, threadId]);

  useEffect(() => {
    if (!canOwnChat || !threadId || !gatewayRef.current) {
      return;
    }

    const liveness = createLivenessApi(threadId);
    livenessRef.current = liveness;
    liveness.setOnline(window.navigator.onLine);
    bumpLiveMeta();

    let unsubscribed = false;

    const unsubscribe = gatewayRef.current.subscribe((event) => {
      if (event.type === "message.inserted") {
        if (event.threadId !== threadId) {
          return;
        }

        upsertRealtimeMessage(event.message);
        removeOptimistic(event.message.clientId);
      }

      if (event.type === "typing.updated") {
        if (event.payload.threadId !== threadId) {
          return;
        }

        if (event.payload.participantId === visitorId) {
          return;
        }

        setRemoteTyping(event.payload.isTyping);
      }

      if (event.type === "heartbeat") {
        if (event.payload.threadId !== threadId) {
          return;
        }

        liveness.upsertHeartbeat(event.payload.participantId, event.payload.at);
        bumpLiveMeta();
      }

      if (event.type === "presence.sync") {
        if (event.threadId !== threadId) {
          return;
        }

        const activeParticipants = new Set(event.participantIds);
        const knownParticipants = Object.keys(liveness.snapshot().participantHeartbeats);
        knownParticipants.forEach((participantId) => {
          if (!activeParticipants.has(participantId)) {
            liveness.removeParticipant(participantId);
          }
        });
        bumpLiveMeta();
      }

      if (event.type === "channel.status") {
        if (event.threadId !== threadId) {
          return;
        }

        liveness.setChannelStatus(event.status);
        bumpLiveMeta();
      }
    });

    const connect = async () => {
      await gatewayRef.current!.connectThread(threadId);
      if (unsubscribed) {
        return;
      }

      const publishHeartbeat = async () => {
        if (!visitorId || !gatewayRef.current || !livenessRef.current) {
          return;
        }

        const at = Date.now();
        livenessRef.current.upsertHeartbeat(visitorId, at);
        bumpLiveMeta();

        await gatewayRef.current.publishHeartbeat({
          threadId,
          participantId: visitorId,
          at,
        });
      };

      await publishHeartbeat();
      const timer = setInterval(() => {
        void publishHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);

      const handleOnline = () => {
        liveness.setOnline(window.navigator.onLine);
        bumpLiveMeta();
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOnline);

      return () => {
        clearInterval(timer);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOnline);
      };
    };

    const cleanupPromise = connect();

    return () => {
      unsubscribed = true;
      unsubscribe();
      resetRealtimeForThread(threadId);
      setRemoteTyping(false);
      setLiveMeta(null);
      void gatewayRef.current?.disconnect();
      void cleanupPromise.then((cleanup) => {
        if (cleanup) {
          cleanup();
        }
      });
    };
  }, [
    bumpLiveMeta,
    canOwnChat,
    removeOptimistic,
    resetRealtimeForThread,
    setLiveMeta,
    setRemoteTyping,
    threadId,
    upsertRealtimeMessage,
    visitorId,
  ]);

  const messagesQuery = useInfiniteQuery({
    queryKey: threadId ? threadMessagesKey(threadId) : ["thread-messages", "idle"],
    enabled: Boolean(threadId && repositoryRef.current),
    refetchInterval: widgetOpen && !canOwnChat ? 5_000 : false,
    refetchIntervalInBackground: widgetOpen && !canOwnChat,
    initialPageParam: null as { createdAt: number; seq: number; id: string } | null,
    queryFn: async ({ pageParam }) => {
      return threadMessagesPageQueryFn(repositoryRef.current!, {
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

  const optimisticMessages = useMemo(() => {
    return Object.values(optimisticByClientId);
  }, [optimisticByClientId]);

  const messages = useMemo(() => {
    return mergeMessages(pagedMessages, realtimeMessages, optimisticMessages);
  }, [optimisticMessages, pagedMessages, realtimeMessages]);

  const resolvedLiveMeta = liveMeta ?? liveMetaQuery.data ?? null;

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

  const isAgentLive = useMemo(() => {
    const heartbeat = resolvedLiveMeta?.participantHeartbeats?.[AGENT_ID];
    if (!heartbeat) {
      return false;
    }

    return clockMs - heartbeat <= HEARTBEAT_TTL_MS;
  }, [clockMs, resolvedLiveMeta]);

  const canEmitTyping = Boolean(
    canOwnChat &&
      threadId &&
      visitorId &&
      resolvedLiveMeta?.online &&
      resolvedLiveMeta.channelStatus === "SUBSCRIBED",
  );
  const canSendMessages = Boolean(
    canOwnChat &&
    threadId &&
      visitorId &&
      resolvedLiveMeta?.online &&
      resolvedLiveMeta.channelStatus === "SUBSCRIBED" &&
      (typeof window === "undefined" || window.navigator.onLine),
  );

  const publishTyping = useCallback(
    async (isTyping: boolean) => {
      if (!canOwnChat || !threadId || !visitorId || !gatewayRef.current) {
        return;
      }

      await gatewayRef.current.setTyping({
        threadId,
        participantId: visitorId,
        isTyping,
        at: Date.now(),
      });
    },
    [canOwnChat, threadId, visitorId],
  );

  const { onInputChange, forceStop } = useTypingSignal({
    threadId,
    participantId: visitorId ?? "visitor-pending",
    canEmit: canEmitTyping,
    publish: async (payload) => {
      await publishTyping(payload.isTyping);
    },
  });

  const sendInternal = useCallback(
    async (body: string, existingClientId?: string) => {
      if (!canOwnChat || !threadId || !visitorId || !repositoryRef.current) {
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
        threadId,
        senderId: visitorId,
        body: safeBody,
        createdAt,
        deliveryState: "sending",
      });

      setOptimistic(optimistic);
      if (!canSendMessages) {
        markOptimisticFailed(clientId, optimistic);
        return;
      }

      try {
        const message = await sendMessageToThread({
          threadId,
          clientId,
          senderId: visitorId,
          senderRole: "visitor",
          body: safeBody,
          createdAt,
        });

        upsertRealtimeMessage(message);
        removeOptimistic(clientId);

        await gatewayRef.current?.sendMessage({ threadId, message });
      } catch {
        markOptimisticFailed(clientId, optimistic);
      }
    },
    [
      canSendMessages,
      canOwnChat,
      markOptimisticFailed,
      removeOptimistic,
      sendMessageToThread,
      setOptimistic,
      threadId,
      upsertRealtimeMessage,
      visitorId,
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
      const failed = optimisticByClientId[clientId];
      if (!failed || failed.deliveryState !== "failed") {
        return;
      }

      await sendInternal(failed.body, clientId);
    },
    [optimisticByClientId, sendInternal],
  );

  const clearConversation = useCallback(async () => {
    if (!canOwnChat || !visitorId || !repositoryRef.current || isClearing) {
      return;
    }

    forceStop();

    const previousThreadId = threadId;
    const now = Date.now();

    resetForClearStart(now);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(THREAD_STORAGE_KEY);
    }

    try {
      const nextThread = await ensureThread({
        visitorId,
        agentId: AGENT_ID,
      });

      setThreadId(nextThread.id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THREAD_STORAGE_KEY, nextThread.id);
      }
    } catch {
      if (previousThreadId) {
        restoreThreadAfterClearFailure(previousThreadId);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(THREAD_STORAGE_KEY, previousThreadId);
        }
      }
    } finally {
      finalizeClear();
    }
  }, [
    ensureThread,
    canOwnChat,
    finalizeClear,
    forceStop,
    isClearing,
    resetForClearStart,
    restoreThreadAfterClearFailure,
    setThreadId,
    threadId,
    visitorId,
  ]);

  const loadOlder = useCallback(async () => {
    if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) {
      return;
    }

    await messagesQuery.fetchNextPage();
  }, [messagesQuery]);

  const markVisitorRead = useCallback(async () => {
    if (!canOwnChat || !threadId || !visitorId || !repositoryRef.current) {
      return;
    }

    const at = Date.now();
    setLastReadAt(at);
    await markThreadRead({
      threadId,
      participantId: visitorId,
      at,
    });
  }, [canOwnChat, markThreadRead, setLastReadAt, threadId, visitorId]);

  useEffect(() => {
    if (!canOwnChat || !widgetOpen || !threadId || !visitorId) {
      return;
    }

    void markVisitorRead();
  }, [canOwnChat, markVisitorRead, threadId, visitorId, widgetOpen]);

  const unreadCount = useMemo(() => {
    return messages.reduce((count, message) => {
      if (message.senderRole !== "agent") {
        return count;
      }

      return message.createdAt > lastReadAt ? count + 1 : count;
    }, 0);
  }, [lastReadAt, messages]);

  return {
    ready,
    isPrimaryTab: !lockReady || isPrimaryTab,
    threadId,
    messages,
    hasOlder: Boolean(messagesQuery.hasNextPage),
    isFetchingOlder: messagesQuery.isFetchingNextPage,
    isSending: sendMessageMutation.isPending,
    isClearing,
    unreadCount,
    isAgentTyping: remoteTyping,
    isServiceLive,
    isAgentLive,
    sendMessage,
    retryMessage,
    clearConversation,
    onTypingInputChange: onInputChange,
    stopTyping: forceStop,
    loadOlder,
    markVisitorRead,
  };
};
