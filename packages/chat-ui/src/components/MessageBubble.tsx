"use client";

import type { Message, ParticipantRole } from "@minicom/chat-core";
import { useEffect, useRef } from "react";

import { RoleIcon } from "./RoleIcon";

const STATUS_COPY: Record<Message["deliveryState"], string> = {
  sending: "Sending...",
  sent: "Sent",
  failed: "Failed",
};

const formatTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
};

export interface MessageBubbleProps {
  message: Message;
  viewerRole: ParticipantRole;
  onRetry?: (clientId: string) => void;
}

export const MessageBubble = ({ message, viewerRole, onRetry }: MessageBubbleProps) => {
  const own = message.senderRole === viewerRole;
  const leftAligned = own;
  const sentByAgent = message.senderRole === "agent";
  const roleLabel = message.senderRole === "agent" ? "Agent" : "Visitor";
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    if (Date.now() - message.createdAt > 20_000) {
      return;
    }

    const node = bubbleRef.current;
    if (!node || typeof node.animate !== "function") {
      return;
    }

    const fromX = leftAligned ? -28 : 28;
    const animation = node.animate(
      [
        { opacity: 0, transform: `translateX(${fromX}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      {
        duration: 260,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    );

    return () => {
      animation.cancel();
    };
  }, [leftAligned, message.clientId, message.createdAt]);

  return (
    <div className={`flex w-full ${leftAligned ? "justify-start" : "justify-end"}`}>
      <div
        ref={bubbleRef}
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          sentByAgent
            ? "bg-sky-600 text-sky-50 dark:bg-sky-500 dark:text-white"
            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        <div
          className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${
            sentByAgent
              ? "bg-sky-500/30 text-sky-100 dark:bg-sky-200/20 dark:text-sky-100"
              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
          }`}
        >
          <RoleIcon role={message.senderRole} className="h-3.5 w-3.5" />
          <span>{roleLabel}</span>
        </div>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
        <div
          className={`mt-2 flex items-center justify-end gap-2 text-[11px] ${
            sentByAgent ? "text-sky-100/90 dark:text-sky-50/90" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {own ? <span>{STATUS_COPY[message.deliveryState]}</span> : null}
          {own && message.deliveryState === "failed" && onRetry ? (
            <button
              type="button"
              onClick={() => onRetry(message.clientId)}
              className={`rounded px-1.5 py-0.5 focus-visible:outline-none focus-visible:ring-2 ${
                sentByAgent
                  ? "bg-black/20 text-white hover:bg-black/35 focus-visible:ring-white"
                  : "bg-black/10 text-zinc-800 hover:bg-black/20 focus-visible:ring-zinc-500 dark:bg-black/20 dark:text-zinc-100 dark:hover:bg-black/35 dark:focus-visible:ring-zinc-400"
              }`}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
