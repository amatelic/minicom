export type ParticipantRole = "visitor" | "agent";

export type DeliveryState = "sending" | "sent" | "failed";

export type ThreadStatus = "open" | "closed";

export interface Thread {
  id: string;
  status: ThreadStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ThreadParticipant {
  threadId: string;
  participantId: string;
  role: ParticipantRole;
  lastReadAt: number | null;
}

export interface Message {
  id: string;
  clientId: string;
  threadId: string;
  senderId: string;
  senderRole: ParticipantRole;
  body: string;
  createdAt: number;
  seq: number;
  deliveryState: DeliveryState;
}

export interface MessageCursor {
  createdAt: number;
  seq: number;
  id: string;
}

export interface ThreadPage {
  items: Message[];
  nextCursor: MessageCursor | null;
}

export interface InboxThread {
  thread: Thread;
  unreadCount: number;
  lastMessage: Message | null;
}

export type RealtimeChannelStatus =
  | "CLOSED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "JOINING"
  | "SUBSCRIBED";

export interface ThreadLiveMeta {
  threadId: string;
  channelStatus: RealtimeChannelStatus;
  online: boolean;
  latestHeartbeatAt: number | null;
  participantHeartbeats: Record<string, number>;
}

export interface TypingPayload {
  threadId: string;
  participantId: string;
  isTyping: boolean;
  at: number;
}

export interface HeartbeatPayload {
  threadId: string;
  participantId: string;
  at: number;
}
