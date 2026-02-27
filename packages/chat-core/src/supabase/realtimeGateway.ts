import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  SupabaseClient,
} from "@supabase/supabase-js";

import type { RealtimeEvent, RealtimeGateway } from "../protocol";
import type { Message, RealtimeChannelStatus, TypingPayload } from "../types";

const isDev = process.env.NODE_ENV !== "production";

const toStatus = (status: string): RealtimeChannelStatus => {
  if (status === "SUBSCRIBED") {
    return "SUBSCRIBED";
  }

  if (status === "TIMED_OUT") {
    return "TIMED_OUT";
  }

  if (status === "CHANNEL_ERROR") {
    return "CHANNEL_ERROR";
  }

  if (status === "CLOSED") {
    return "CLOSED";
  }

  return "JOINING";
};

export class SupabaseRealtimeGateway implements RealtimeGateway {
  private channel: RealtimeChannel | null = null;
  private threadId: string | null = null;
  private readonly listeners = new Set<(event: RealtimeEvent) => void>();

  constructor(private readonly supabase: SupabaseClient, private readonly participantId: string) {}

  subscribe(handler: (event: RealtimeEvent) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private emit(event: RealtimeEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  private logChannelStatus(threadId: string, status: RealtimeChannelStatus, err?: Error): void {
    if (!isDev) {
      return;
    }

    const errorMessage = err ? (err instanceof Error ? err.message : String(err)) : null;

    if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || errorMessage) {
      console.warn("[SupabaseRealtimeGateway] Channel issue", {
        threadId,
        participantId: this.participantId,
        status,
        error: errorMessage,
      });
      return;
    }

    console.debug("[SupabaseRealtimeGateway] Channel status", {
      threadId,
      participantId: this.participantId,
      status,
    });
  }

  async connectThread(threadId: string): Promise<void> {
    if (this.threadId === threadId && this.channel) {
      return;
    }

    await this.disconnect();

    this.threadId = threadId;
    const channel = this.supabase.channel(`thread:${threadId}`, {
      config: {
        presence: {
          key: this.participantId,
        },
      },
    });

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
        const next = payload.new as {
          id: string;
          client_id: string;
          thread_id: string;
          sender_id: string;
          sender_role: "visitor" | "agent";
          body: string;
          created_at: string;
          seq: number;
        };

        const message: Message = {
          id: next.id,
          clientId: next.client_id,
          threadId: next.thread_id,
          senderId: next.sender_id,
          senderRole: next.sender_role,
          body: next.body,
          createdAt: new Date(next.created_at).getTime(),
          seq: next.seq,
          deliveryState: "sent",
        };

        this.emit({
          type: "message.inserted",
          threadId,
          message,
        });
      },
    );

    channel.on("broadcast", { event: "typing" }, (payload: { payload: unknown }) => {
      const typing = payload.payload as TypingPayload;
      this.emit({ type: "typing.updated", payload: typing });
    });

    channel.on("presence", { event: "sync" }, () => {
      type PresenceEntry = { at?: number | string };
      const state = channel.presenceState<PresenceEntry>();
      const participantIds = Object.keys(state);

      this.emit({
        type: "presence.sync",
        threadId,
        participantIds,
      });

      Object.entries(state).forEach(([participantId, entries]) => {
        const typedEntries = entries as PresenceEntry[];
        if (!typedEntries.length) {
          return;
        }

        const entry = typedEntries[typedEntries.length - 1];
        const heartbeatAt = Number(entry?.at ?? Date.now());

        this.emit({
          type: "heartbeat",
          payload: {
            threadId,
            participantId,
            at: heartbeatAt,
          },
        });
      });
    });

    channel.subscribe((status: "SUBSCRIBED" | "TIMED_OUT" | "CHANNEL_ERROR" | "CLOSED" | "JOINING", err?: Error) => {
      const nextStatus = toStatus(status);
      this.emit({
        type: "channel.status",
        threadId,
        status: nextStatus,
      });
      this.logChannelStatus(threadId, nextStatus, err);
    });

    this.channel = channel;
  }

  async sendMessage(payload: { threadId: string; message: Message }): Promise<void> {
    if (!this.channel) {
      return;
    }

    await this.channel.send({
      type: "broadcast",
      event: "message",
      payload,
    });
  }

  async setTyping(payload: TypingPayload): Promise<void> {
    if (!this.channel) {
      return;
    }

    await this.channel.send({
      type: "broadcast",
      event: "typing",
      payload,
    });
  }

  async publishHeartbeat(payload: { threadId: string; participantId: string; at: number }): Promise<void> {
    if (!this.channel) {
      return;
    }

    await this.channel.track({
      participantId: payload.participantId,
      at: payload.at,
    });
  }

  async disconnect(): Promise<void> {
    if (!this.channel) {
      return;
    }

    await this.channel.unsubscribe();
    this.channel = null;
  }
}
