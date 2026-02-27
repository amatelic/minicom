import type { RealtimeChannelStatus, ThreadLiveMeta } from "./types";

export const HEARTBEAT_INTERVAL_MS = 8_000;
export const HEARTBEAT_TTL_MS = 20_000;

export interface LivenessApi {
  setOnline(online: boolean): void;
  setChannelStatus(status: RealtimeChannelStatus): void;
  upsertHeartbeat(participantId: string, at: number): void;
  removeParticipant(participantId: string): void;
  isServiceLive(now: number): boolean;
  isParticipantLive(participantId: string, now: number): boolean;
  snapshot(): ThreadLiveMeta;
}

export const createLivenessApi = (threadId: string): LivenessApi => {
  let online = true;
  let channelStatus: RealtimeChannelStatus = "CLOSED";
  let latestHeartbeatAt: number | null = null;
  const participantHeartbeats = new Map<string, number>();

  const isFresh = (value: number | null, now: number): boolean => {
    if (!value) {
      return false;
    }

    return now - value <= HEARTBEAT_TTL_MS;
  };

  return {
    setOnline: (value) => {
      online = value;
    },

    setChannelStatus: (status) => {
      channelStatus = status;
    },

    upsertHeartbeat: (participantId, at) => {
      const current = participantHeartbeats.get(participantId) ?? 0;
      if (at < current) {
        return;
      }

      participantHeartbeats.set(participantId, at);
      latestHeartbeatAt = Math.max(latestHeartbeatAt ?? 0, at);
    },

    removeParticipant: (participantId) => {
      if (!participantHeartbeats.has(participantId)) {
        return;
      }

      participantHeartbeats.delete(participantId);
    },

    isServiceLive: (now) => {
      return online && channelStatus === "SUBSCRIBED" && isFresh(latestHeartbeatAt, now);
    },

    isParticipantLive: (participantId, now) => {
      const heartbeat = participantHeartbeats.get(participantId) ?? null;
      return isFresh(heartbeat, now);
    },

    snapshot: () => {
      return {
        threadId,
        channelStatus,
        online,
        latestHeartbeatAt,
        participantHeartbeats: Object.fromEntries(participantHeartbeats.entries()),
      };
    },
  };
};
