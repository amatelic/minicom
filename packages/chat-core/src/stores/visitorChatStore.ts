import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { Message, ThreadLiveMeta } from "../types";
import { mergeMessages } from "../utils/messages";

export interface VisitorChatState {
  visitorId: string | null;
  threadId: string | null;
  ready: boolean;
  isClearing: boolean;
  remoteTyping: boolean;
  lastReadAt: number;
  clockMs: number;
  optimisticByClientId: Record<string, Message>;
  realtimeMessages: Message[];
  liveMeta: ThreadLiveMeta | null;
}

export interface VisitorChatActions {
  setVisitorId: (visitorId: string | null) => void;
  setThreadId: (threadId: string | null) => void;
  setReady: (ready: boolean) => void;
  setIsClearing: (isClearing: boolean) => void;
  setRemoteTyping: (isTyping: boolean) => void;
  upsertRealtimeMessage: (message: Message) => void;
  resetRealtimeForThread: (threadId: string) => void;
  setOptimistic: (message: Message) => void;
  removeOptimistic: (clientId: string) => void;
  markOptimisticFailed: (clientId: string, fallback: Message) => void;
  clearOptimistic: () => void;
  setLiveMeta: (liveMeta: ThreadLiveMeta | null) => void;
  setClockMs: (clockMs: number) => void;
  setLastReadAt: (at: number) => void;
  resetForClearStart: (now: number) => void;
  restoreThreadAfterClearFailure: (threadId: string) => void;
  finalizeClear: () => void;
}

export type VisitorChatStoreState = VisitorChatState & VisitorChatActions;

const createInitialState = (): VisitorChatState => ({
  visitorId: null,
  threadId: null,
  ready: false,
  isClearing: false,
  remoteTyping: false,
  lastReadAt: Date.now(),
  clockMs: Date.now(),
  optimisticByClientId: {},
  realtimeMessages: [],
  liveMeta: null,
});

export const useVisitorChatStore = create<VisitorChatStoreState>((set) => ({
  ...createInitialState(),

  setVisitorId: (visitorId) => {
    set((state) => {
      if (state.visitorId === visitorId) {
        return state;
      }

      return { visitorId };
    });
  },

  setThreadId: (threadId) => {
    set((state) => {
      if (state.threadId === threadId) {
        return state;
      }

      return { threadId };
    });
  },

  setReady: (ready) => {
    set((state) => {
      if (state.ready === ready) {
        return state;
      }

      return { ready };
    });
  },

  setIsClearing: (isClearing) => {
    set((state) => {
      if (state.isClearing === isClearing) {
        return state;
      }

      return { isClearing };
    });
  },

  setRemoteTyping: (isTyping) => {
    set((state) => {
      if (state.remoteTyping === isTyping) {
        return state;
      }

      return { remoteTyping: isTyping };
    });
  },

  upsertRealtimeMessage: (message) => {
    set((state) => ({
      realtimeMessages: mergeMessages(state.realtimeMessages, [message]),
    }));
  },

  resetRealtimeForThread: (threadId) => {
    set((state) => {
      if (state.threadId !== threadId || !state.realtimeMessages.length) {
        return state;
      }

      return { realtimeMessages: [] };
    });
  },

  setOptimistic: (message) => {
    set((state) => {
      const current = state.optimisticByClientId[message.clientId];
      if (current === message) {
        return state;
      }

      return {
        optimisticByClientId: {
          ...state.optimisticByClientId,
          [message.clientId]: message,
        },
      };
    });
  },

  removeOptimistic: (clientId) => {
    set((state) => {
      if (!state.optimisticByClientId[clientId]) {
        return state;
      }

      const nextOptimistic = { ...state.optimisticByClientId };
      delete nextOptimistic[clientId];

      return {
        optimisticByClientId: nextOptimistic,
      };
    });
  },

  markOptimisticFailed: (clientId, fallback) => {
    set((state) => {
      const current = state.optimisticByClientId[clientId] ?? fallback;
      const nextFailed: Message = {
        ...current,
        deliveryState: "failed",
      };

      const previous = state.optimisticByClientId[clientId];
      if (
        previous &&
        previous.deliveryState === "failed" &&
        previous.body === nextFailed.body &&
        previous.createdAt === nextFailed.createdAt
      ) {
        return state;
      }

      return {
        optimisticByClientId: {
          ...state.optimisticByClientId,
          [clientId]: nextFailed,
        },
      };
    });
  },

  clearOptimistic: () => {
    set((state) => {
      if (!Object.keys(state.optimisticByClientId).length) {
        return state;
      }

      return { optimisticByClientId: {} };
    });
  },

  setLiveMeta: (liveMeta) => {
    set((state) => {
      if (state.liveMeta === liveMeta) {
        return state;
      }

      return { liveMeta };
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

  setLastReadAt: (at) => {
    set((state) => {
      if (state.lastReadAt === at) {
        return state;
      }

      return { lastReadAt: at };
    });
  },

  resetForClearStart: (now) => {
    set(() => ({
      isClearing: true,
      ready: false,
      threadId: null,
      lastReadAt: now,
      remoteTyping: false,
      optimisticByClientId: {},
      realtimeMessages: [],
      liveMeta: null,
    }));
  },

  restoreThreadAfterClearFailure: (threadId) => {
    set({ threadId });
  },

  finalizeClear: () => {
    set({
      ready: true,
      isClearing: false,
    });
  },
}));

export const useVisitorChatStoreSlice = () =>
  useVisitorChatStore(
    useShallow((state) => ({
      visitorId: state.visitorId,
      threadId: state.threadId,
      ready: state.ready,
      isClearing: state.isClearing,
      remoteTyping: state.remoteTyping,
      lastReadAt: state.lastReadAt,
      clockMs: state.clockMs,
      optimisticByClientId: state.optimisticByClientId,
      realtimeMessages: state.realtimeMessages,
      liveMeta: state.liveMeta,
      setVisitorId: state.setVisitorId,
      setThreadId: state.setThreadId,
      setReady: state.setReady,
      setIsClearing: state.setIsClearing,
      setRemoteTyping: state.setRemoteTyping,
      upsertRealtimeMessage: state.upsertRealtimeMessage,
      resetRealtimeForThread: state.resetRealtimeForThread,
      setOptimistic: state.setOptimistic,
      removeOptimistic: state.removeOptimistic,
      markOptimisticFailed: state.markOptimisticFailed,
      clearOptimistic: state.clearOptimistic,
      setLiveMeta: state.setLiveMeta,
      setClockMs: state.setClockMs,
      setLastReadAt: state.setLastReadAt,
      resetForClearStart: state.resetForClearStart,
      restoreThreadAfterClearFailure: state.restoreThreadAfterClearFailure,
      finalizeClear: state.finalizeClear,
    })),
  );
