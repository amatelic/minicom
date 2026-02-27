export const threadMessagesKey = (threadId: string) => ["thread-messages", threadId] as const;

export const threadLiveMetaKey = (threadId: string) => ["thread-live-meta", threadId] as const;

export const agentInboxKey = ["agent-inbox"] as const;
