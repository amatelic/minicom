import type { ParticipantRole } from "../types";

export interface ThreadRow {
  id: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

export interface ThreadParticipantRow {
  thread_id: string;
  participant_id: string;
  role: ParticipantRole;
  last_read_at: string | null;
}

export interface MessageRow {
  id: string;
  client_id: string;
  thread_id: string;
  sender_id: string;
  sender_role: ParticipantRole;
  body: string;
  created_at: string;
  seq: number;
}
