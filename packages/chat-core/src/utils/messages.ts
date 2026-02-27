import type { Message } from "../types";

const stableClientKey = (message: Message): string => {
  const clientId = message.clientId.trim() || message.id;
  return `${message.threadId}:${clientId}`;
};

const mergeMessageState = (existing: Message, incoming: Message): Message => {
  if (existing.deliveryState === "sent" && incoming.deliveryState !== "sent") {
    return existing;
  }

  if (incoming.deliveryState === "sent" && existing.deliveryState !== "sent") {
    return {
      ...existing,
      ...incoming,
    };
  }

  return {
    ...existing,
    ...incoming,
  };
};

export const sortMessages = (messages: Message[]): Message[] => {
  return [...messages].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }

    if (left.seq !== right.seq) {
      return left.seq - right.seq;
    }

    return left.id.localeCompare(right.id);
  });
};

export const mergeMessages = (...sets: Array<Message[] | undefined>): Message[] => {
  const byClientKey = new Map<string, Message>();

  sets.forEach((set) => {
    if (!set) {
      return;
    }

    set.forEach((message) => {
      const key = stableClientKey(message);
      const existing = byClientKey.get(key);
      if (!existing) {
        byClientKey.set(key, message);
        return;
      }

      byClientKey.set(key, mergeMessageState(existing, message));
    });
  });

  return sortMessages([...byClientKey.values()]);
};

export const flattenPages = (pages: Array<{ items: Message[] }>): Message[] => {
  return pages
    .slice()
    .reverse()
    .flatMap((page) => page.items);
};
