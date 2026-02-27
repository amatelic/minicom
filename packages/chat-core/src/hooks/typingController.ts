import type { TypingPayload } from "../types";

export const TYPING_DEBOUNCE_MS = 300;
export const TYPING_IDLE_MS = 3_000;
export const TYPING_REFRESH_MS = 1_200;

export interface TypingController {
  onInputChange(value: string): void;
  forceStop(): void;
  setCanEmit(canEmit: boolean): void;
  setThreadId(threadId: string | null): void;
  setParticipantId(participantId: string): void;
  destroy(): void;
}

export interface CreateTypingControllerOptions {
  threadId: string | null;
  participantId: string;
  canEmit: boolean;
  publish: (payload: TypingPayload) => Promise<void> | void;
}

export const createTypingController = (options: CreateTypingControllerOptions): TypingController => {
  let currentThreadId = options.threadId;
  let currentParticipantId = options.participantId;
  let currentCanEmit = options.canEmit;

  let isTyping = false;
  let lastActivityAt: number | null = null;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  const clearDebounce = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const clearRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };

  const emit = (typing: boolean, force = false) => {
    if (!currentThreadId) {
      return;
    }

    if (!force && !currentCanEmit) {
      return;
    }

    if (isTyping === typing && !typing) {
      return;
    }

    isTyping = typing;
    void options.publish({
      threadId: currentThreadId,
      participantId: currentParticipantId,
      isTyping: typing,
      at: Date.now(),
    });
  };

  const forceStop = () => {
    clearDebounce();
    clearIdle();
    clearRefresh();
    lastActivityAt = null;
    emit(false, true);
  };

  const scheduleIdleStop = () => {
    clearIdle();
    idleTimer = setTimeout(() => {
      forceStop();
    }, TYPING_IDLE_MS);
  };

  const ensureRefreshTicker = () => {
    if (refreshTimer) {
      return;
    }

    refreshTimer = setInterval(() => {
      if (!lastActivityAt) {
        return;
      }

      const now = Date.now();
      if (now - lastActivityAt >= TYPING_IDLE_MS) {
        forceStop();
        return;
      }

      emit(true);
    }, TYPING_REFRESH_MS);
  };

  return {
    onInputChange: (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        forceStop();
        return;
      }

      lastActivityAt = Date.now();
      scheduleIdleStop();
      clearDebounce();

      if (!currentCanEmit) {
        return;
      }

      debounceTimer = setTimeout(() => {
        emit(true);
        ensureRefreshTicker();
      }, TYPING_DEBOUNCE_MS);
    },

    forceStop,

    setCanEmit: (canEmit) => {
      const changed = currentCanEmit !== canEmit;
      currentCanEmit = canEmit;
      if (changed && !canEmit) {
        forceStop();
      }
    },

    setThreadId: (threadId) => {
      currentThreadId = threadId;
      if (!currentThreadId) {
        forceStop();
      }
    },

    setParticipantId: (participantId) => {
      currentParticipantId = participantId;
    },

    destroy: () => {
      forceStop();
    },
  };
};
