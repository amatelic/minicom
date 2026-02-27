import type { SupabaseClient } from "@supabase/supabase-js";

import type { EnsureThreadInput, FetchThreadPageInput, MessageRepository, SendMessageInput } from "../protocol";
import type { InboxThread, Message, MessageCursor, Thread } from "../types";
import { validateMessageBody } from "../utils/messageContent";
import { sortInboxThreads } from "../utils/inbox";

import type { MessageRow, ThreadParticipantRow, ThreadRow } from "./types";

const toEpoch = (iso: string): number => new Date(iso).getTime();

const toThread = (row: ThreadRow): Thread => ({
  id: row.id,
  status: row.status,
  createdAt: toEpoch(row.created_at),
  updatedAt: toEpoch(row.updated_at),
});

const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  clientId: row.client_id,
  threadId: row.thread_id,
  senderId: row.sender_id,
  senderRole: row.sender_role,
  body: row.body,
  createdAt: toEpoch(row.created_at),
  seq: row.seq,
  deliveryState: "sent",
});

const buildCursorFilter = (cursor: MessageCursor): string => {
  const createdIso = new Date(cursor.createdAt).toISOString();
  return `created_at.lt.${createdIso},and(created_at.eq.${createdIso},seq.lt.${cursor.seq}),and(created_at.eq.${createdIso},seq.eq.${cursor.seq},id.lt.${cursor.id})`;
};

export class SupabaseMessageRepository implements MessageRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async ensureThread(input: EnsureThreadInput): Promise<Thread> {
    const now = new Date().toISOString();
    let threadRow: ThreadRow | null = null;

    if (input.threadId) {
      const { data: existing, error: existingError } = await this.supabase
        .from("threads")
        .select("id,status,created_at,updated_at")
        .eq("id", input.threadId)
        .maybeSingle<ThreadRow>();

      if (existingError) {
        throw existingError;
      }

      threadRow = existing;
    }

    if (!threadRow) {
      const threadInsert: {
        status: "open";
        created_at: string;
        updated_at: string;
        id?: string;
      } = {
        status: "open",
        created_at: now,
        updated_at: now,
      };

      if (input.threadId) {
        threadInsert.id = input.threadId;
      }

      const { data: created, error: createError } = await this.supabase
        .from("threads")
        .insert(threadInsert)
        .select("id,status,created_at,updated_at")
        .single<ThreadRow>();

      if (createError) {
        throw createError;
      }

      threadRow = created;

      const participants = [
        {
          thread_id: threadRow.id,
          participant_id: input.visitorId,
          role: "visitor",
          last_read_at: null,
        },
        {
          thread_id: threadRow.id,
          participant_id: input.agentId,
          role: "agent",
          last_read_at: null,
        },
      ];

      const { error: participantError } = await this.supabase.from("thread_participants").upsert(participants, {
        onConflict: "thread_id,participant_id",
      });

      if (participantError) {
        throw participantError;
      }
    }

    return toThread(threadRow);
  }

  async fetchThreadPage(input: FetchThreadPageInput) {
    const pageSize = Math.max(1, Math.min(input.limit, 100));

    let query = this.supabase
      .from("messages")
      .select("id,client_id,thread_id,sender_id,sender_role,body,created_at,seq")
      .eq("thread_id", input.threadId)
      .order("created_at", { ascending: false })
      .order("seq", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageSize + 1);

    if (input.cursor) {
      query = query.or(buildCursorFilter(input.cursor));
    }

    const { data, error } = await query.returns<MessageRow[]>();

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const hasMore = rows.length > pageSize;
    const slice = hasMore ? rows.slice(0, pageSize) : rows;
    const ordered = slice
      .map((row: MessageRow) => toMessage(row))
      .reverse();

    const last = slice[slice.length - 1] ?? null;

    return {
      items: ordered,
      nextCursor: hasMore && last
        ? {
            createdAt: toEpoch(last.created_at),
            seq: last.seq,
            id: last.id,
          }
        : null,
    };
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const validation = validateMessageBody(input.body);
    if (!validation.isValid) {
      throw new Error(`Invalid message body: ${validation.reason}`);
    }

    const { data, error } = await this.supabase
      .from("messages")
      .upsert(
        {
          thread_id: input.threadId,
          client_id: input.clientId,
          sender_id: input.senderId,
          sender_role: input.senderRole,
          body: validation.value,
          created_at: new Date(input.createdAt).toISOString(),
        },
        {
          onConflict: "thread_id,client_id",
        },
      )
      .select("id,client_id,thread_id,sender_id,sender_role,body,created_at,seq")
      .single<MessageRow>();

    if (error) {
      throw error;
    }

    await this.supabase
      .from("threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.threadId);

    return toMessage(data);
  }

  async markThreadRead(input: { threadId: string; participantId: string; at: number }): Promise<void> {
    const { error } = await this.supabase
      .from("thread_participants")
      .update({ last_read_at: new Date(input.at).toISOString() })
      .eq("thread_id", input.threadId)
      .eq("participant_id", input.participantId);

    if (error) {
      throw error;
    }
  }

  async fetchAgentInbox(input: { agentId: string }): Promise<InboxThread[]> {
    const { data: participantRows, error: participantsError } = await this.supabase
      .from("thread_participants")
      .select("thread_id,participant_id,role,last_read_at")
      .eq("participant_id", input.agentId)
      .returns<ThreadParticipantRow[]>();

    if (participantsError) {
      throw participantsError;
    }

    const threadIds = (participantRows ?? []).map((row: ThreadParticipantRow) => row.thread_id);
    if (!threadIds.length) {
      return [];
    }

    const { data: threadRows, error: threadsError } = await this.supabase
      .from("threads")
      .select("id,status,created_at,updated_at")
      .in("id", threadIds)
      .eq("status", "open")
      .returns<ThreadRow[]>();

    if (threadsError) {
      throw threadsError;
    }

    const { data: messageRows, error: messageError } = await this.supabase
      .from("messages")
      .select("id,client_id,thread_id,sender_id,sender_role,body,created_at,seq")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false })
      .order("seq", { ascending: false })
      .returns<MessageRow[]>();

    if (messageError) {
      throw messageError;
    }

    const participantByThread = new Map<string, ThreadParticipantRow>(
      (participantRows ?? []).map((row: ThreadParticipantRow) => [row.thread_id, row]),
    );

    const messagesByThread = new Map<string, Message[]>();
    (messageRows ?? []).forEach((row: MessageRow) => {
      const entry = messagesByThread.get(row.thread_id) ?? [];
      entry.push(toMessage(row));
      messagesByThread.set(row.thread_id, entry);
    });

    return sortInboxThreads(
      (threadRows ?? [])
      .map((threadRow: ThreadRow) => {
        const thread = toThread(threadRow);
        const messages = messagesByThread.get(thread.id) ?? [];
        const lastMessage = messages[0] ?? null;
        const participant = participantByThread.get(thread.id);
        const lastReadAt = participant?.last_read_at ? toEpoch(participant.last_read_at) : 0;
        const unreadCount = messages.reduce((count, message) => {
          if (message.senderId === input.agentId) {
            return count;
          }

          return message.createdAt > lastReadAt ? count + 1 : count;
        }, 0);

        return {
          thread,
          unreadCount,
          lastMessage,
        };
      }),
    );
  }
}
