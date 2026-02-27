import { useCallback, useEffect, useRef } from "react";

import type { TypingPayload } from "../types";

import { createTypingController } from "./typingController";

export interface UseTypingSignalOptions {
  threadId: string | null;
  participantId: string;
  canEmit: boolean;
  publish: (payload: TypingPayload) => Promise<void> | void;
}

export interface TypingSignalApi {
  onInputChange: (value: string) => void;
  forceStop: () => void;
}

export const useTypingSignal = ({
  threadId,
  participantId,
  canEmit,
  publish,
}: UseTypingSignalOptions): TypingSignalApi => {
  const publishRef = useRef(publish);
  const controllerRef = useRef(
    createTypingController({
      threadId,
      participantId,
      canEmit,
      publish: (payload) => publishRef.current(payload),
    }),
  );

  useEffect(() => {
    publishRef.current = publish;
  }, [publish]);

  useEffect(() => {
    controllerRef.current.setThreadId(threadId);
  }, [threadId]);

  useEffect(() => {
    controllerRef.current.setParticipantId(participantId);
  }, [participantId]);

  useEffect(() => {
    controllerRef.current.setCanEmit(canEmit);
  }, [canEmit]);

  useEffect(() => {
    return () => {
      controllerRef.current.destroy();
    };
  }, []);

  const onInputChange = useCallback((value: string) => {
    controllerRef.current.onInputChange(value);
  }, []);

  const forceStop = useCallback(() => {
    controllerRef.current.forceStop();
  }, []);

  return {
    onInputChange,
    forceStop,
  };
};
