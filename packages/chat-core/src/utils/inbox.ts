import type { InboxThread, Message, Thread } from "../types";

export interface ApplyMessageToInboxOptions {
  agentId: string;
  activeThreadId: string | null;
}

export interface ApplyMessageToInboxResult {
  items: InboxThread[];
  insertedUnknownThread: boolean;
}

const sortInboxThreadComparator = (left: InboxThread, right: InboxThread): number => {
  const unreadDelta = right.unreadCount - left.unreadCount;
  if (unreadDelta !== 0) {
    return unreadDelta;
  }

  return right.thread.updatedAt - left.thread.updatedAt;
};

const placeholderThread = (threadId: string, createdAt: number): Thread => ({
  id: threadId,
  status: "open",
  createdAt,
  updatedAt: createdAt,
});

export const sortInboxThreads = (items: InboxThread[]): InboxThread[] => {
  return items.slice().sort(sortInboxThreadComparator);
};

export const applyMessageToInbox = (
  current: InboxThread[] | undefined,
  message: Message,
  options: ApplyMessageToInboxOptions,
): ApplyMessageToInboxResult => {
  const nextItems = [...(current ?? [])];
  const threadIndex = nextItems.findIndex((item) => item.thread.id === message.threadId);

  if (threadIndex === -1) {
    const unreadCount =
      message.senderId === options.agentId || message.threadId === options.activeThreadId ? 0 : 1;

    nextItems.push({
      thread: placeholderThread(message.threadId, message.createdAt),
      unreadCount,
      lastMessage: message,
    });

    return {
      items: sortInboxThreads(nextItems),
      insertedUnknownThread: true,
    };
  }

  const existing = nextItems[threadIndex];
  if (!existing) {
    return {
      items: sortInboxThreads(nextItems),
      insertedUnknownThread: false,
    };
  }

  const nextUnreadCount =
    message.senderId === options.agentId
      ? existing.unreadCount
      : message.threadId === options.activeThreadId
        ? 0
        : existing.unreadCount + 1;

  nextItems[threadIndex] = {
    ...existing,
    thread: {
      ...existing.thread,
      updatedAt: Math.max(existing.thread.updatedAt, message.createdAt),
    },
    unreadCount: nextUnreadCount,
    lastMessage: message,
  };

  return {
    items: sortInboxThreads(nextItems),
    insertedUnknownThread: false,
  };
};
