import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { InboxThread, Message, ThreadLiveMeta } from "../types";
import { mergeMessages } from "../utils/messages";

export interface AgentChatState {
  activeThreadId: string | null;
  clockMs: number;
  remoteTypingByThread: Record<string, boolean>;
  optimisticByThread: Record<string, Record<string, Message>>;
  realtimeByThread: Record<string, Message[]>;
  liveMetaByThread: Record<string, ThreadLiveMeta>;
}

export interface AgentChatActions {
  setActiveThreadId: (threadId: string | null) => void;
  syncActiveThreadFromInbox: (inbox: InboxThread[]) => void;
  setRemoteTyping: (threadId: string, isTyping: boolean) => void;
  upsertRealtimeMessage: (threadId: string, message: Message) => void;
  clearRealtimeForThread: (threadId: string) => void;
  setOptimistic: (threadId: string, message: Message) => void;
  removeOptimistic: (threadId: string, clientId: string) => void;
  markOptimisticFailed: (threadId: string, clientId: string, fallback: Message) => void;
  setLiveMeta: (threadId: string, liveMeta: ThreadLiveMeta | null) => void;
  setClockMs: (clockMs: number) => void;
}

export type AgentChatStoreState = AgentChatState & AgentChatActions;

const createInitialState = (): AgentChatState => ({
  activeThreadId: null,
  clockMs: Date.now(),
  remoteTypingByThread: {},
  optimisticByThread: {},
  realtimeByThread: {},
  liveMetaByThread: {},
});

export const useAgentChatStore = create<AgentChatStoreState>((set) => ({
  ...createInitialState(),

  setActiveThreadId: (threadId) => {
    set((state) => {
      if (state.activeThreadId === threadId) {
        return state;
      }

      return { activeThreadId: threadId };
    });
  },

  syncActiveThreadFromInbox: (inbox) => {
    set((state) => {
      if (!inbox.length) {
        if (state.activeThreadId === null) {
          return state;
        }

        return { activeThreadId: null };
      }

      if (state.activeThreadId && inbox.some((item) => item.thread.id === state.activeThreadId)) {
        return state;
      }

      return { activeThreadId: inbox[0].thread.id };
    });
  },

  setRemoteTyping: (threadId, isTyping) => {
    set((state) => {
      const current = state.remoteTypingByThread[threadId] ?? false;
      if (current === isTyping) {
        return state;
      }

      return {
        remoteTypingByThread: {
          ...state.remoteTypingByThread,
          [threadId]: isTyping,
        },
      };
    });
  },

  upsertRealtimeMessage: (threadId, message) => {
    set((state) => {
      const currentMessages = state.realtimeByThread[threadId] ?? [];
      return {
        realtimeByThread: {
          ...state.realtimeByThread,
          [threadId]: mergeMessages(currentMessages, [message]),
        },
      };
    });
  },

  clearRealtimeForThread: (threadId) => {
    set((state) => {
      if (!state.realtimeByThread[threadId]) {
        return state;
      }

      const nextRealtime = { ...state.realtimeByThread };
      delete nextRealtime[threadId];

      return { realtimeByThread: nextRealtime };
    });
  },

  setOptimistic: (threadId, message) => {
    set((state) => {
      const currentByThread = state.optimisticByThread[threadId] ?? {};
      const current = currentByThread[message.clientId];
      if (current === message) {
        return state;
      }

      return {
        optimisticByThread: {
          ...state.optimisticByThread,
          [threadId]: {
            ...currentByThread,
            [message.clientId]: message,
          },
        },
      };
    });
  },

  removeOptimistic: (threadId, clientId) => {
    set((state) => {
      const currentByThread = state.optimisticByThread[threadId];
      if (!currentByThread || !currentByThread[clientId]) {
        return state;
      }

      const nextByThread = { ...currentByThread };
      delete nextByThread[clientId];

      const nextOptimistic = { ...state.optimisticByThread };
      if (!Object.keys(nextByThread).length) {
        delete nextOptimistic[threadId];
      } else {
        nextOptimistic[threadId] = nextByThread;
      }

      return { optimisticByThread: nextOptimistic };
    });
  },

  markOptimisticFailed: (threadId, clientId, fallback) => {
    set((state) => {
      const currentByThread = state.optimisticByThread[threadId] ?? {};
      const current = currentByThread[clientId] ?? fallback;
      const nextFailed: Message = {
        ...current,
        deliveryState: "failed",
      };

      const previous = currentByThread[clientId];
      if (
        previous &&
        previous.deliveryState === "failed" &&
        previous.body === nextFailed.body &&
        previous.createdAt === nextFailed.createdAt
      ) {
        return state;
      }

      return {
        optimisticByThread: {
          ...state.optimisticByThread,
          [threadId]: {
            ...currentByThread,
            [clientId]: nextFailed,
          },
        },
      };
    });
  },

  setLiveMeta: (threadId, liveMeta) => {
    set((state) => {
      if (liveMeta === null) {
        if (!state.liveMetaByThread[threadId]) {
          return state;
        }

        const nextLiveMeta = { ...state.liveMetaByThread };
        delete nextLiveMeta[threadId];
        return { liveMetaByThread: nextLiveMeta };
      }

      if (state.liveMetaByThread[threadId] === liveMeta) {
        return state;
      }

      return {
        liveMetaByThread: {
          ...state.liveMetaByThread,
          [threadId]: liveMeta,
        },
      };
    });
  },

  setClockMs: (clockMs) => {
    set((state) => {
      if (state.clockMs === clockMs) {
        return state;
      }

      return { clockMs };
    });
  },
}));

export const useAgentChatStoreSlice = () =>
  useAgentChatStore(
    useShallow((state) => ({
      activeThreadId: state.activeThreadId,
      clockMs: state.clockMs,
      remoteTypingByThread: state.remoteTypingByThread,
      optimisticByThread: state.optimisticByThread,
      realtimeByThread: state.realtimeByThread,
      liveMetaByThread: state.liveMetaByThread,
      setActiveThreadId: state.setActiveThreadId,
      syncActiveThreadFromInbox: state.syncActiveThreadFromInbox,
      setRemoteTyping: state.setRemoteTyping,
      upsertRealtimeMessage: state.upsertRealtimeMessage,
      clearRealtimeForThread: state.clearRealtimeForThread,
      setOptimistic: state.setOptimistic,
      removeOptimistic: state.removeOptimistic,
      markOptimisticFailed: state.markOptimisticFailed,
      setLiveMeta: state.setLiveMeta,
      setClockMs: state.setClockMs,
    })),
  );
