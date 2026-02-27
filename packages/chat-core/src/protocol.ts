import type {
  HeartbeatPayload,
  InboxThread,
  Message,
  MessageCursor,
  ParticipantRole,
  RealtimeChannelStatus,
  Thread,
  ThreadPage,
  TypingPayload,
} from "./types";

export interface FetchThreadPageInput {
  threadId: string;
  cursor: MessageCursor | null;
  limit: number;
}

export interface EnsureThreadInput {
  threadId?: string;
  visitorId: string;
  agentId: string;
}

export interface SendMessageInput {
  threadId: string;
  clientId: string;
  senderId: string;
  senderRole: ParticipantRole;
  body: string;
  createdAt: number;
}

export interface MessageRepository {
  ensureThread(input: EnsureThreadInput): Promise<Thread>;
  fetchThreadPage(input: FetchThreadPageInput): Promise<ThreadPage>;
  sendMessage(input: SendMessageInput): Promise<Message>;
  markThreadRead(input: { threadId: string; participantId: string; at: number }): Promise<void>;
  fetchAgentInbox(input: { agentId: string }): Promise<InboxThread[]>;
}

export type RealtimeEvent =
  | { type: "message.inserted"; threadId: string; message: Message }
  | { type: "typing.updated"; payload: TypingPayload }
  | { type: "heartbeat"; payload: HeartbeatPayload }
  | { type: "presence.sync"; threadId: string; participantIds: string[] }
  | { type: "channel.status"; threadId: string; status: RealtimeChannelStatus };

export interface RealtimeGateway {
  connectThread(threadId: string): Promise<void>;
  sendMessage(payload: { threadId: string; message: Message }): Promise<void>;
  setTyping(payload: TypingPayload): Promise<void>;
  publishHeartbeat(payload: HeartbeatPayload): Promise<void>;
  subscribe(handler: (event: RealtimeEvent) => void): () => void;
  disconnect(): Promise<void>;
}
