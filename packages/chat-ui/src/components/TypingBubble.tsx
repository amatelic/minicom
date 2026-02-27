"use client";

import type { ParticipantRole } from "@minicom/chat-core";

export interface TypingBubbleProps {
  role: ParticipantRole;
  viewerRole: ParticipantRole;
  copy?: string;
}

const TypingDots = ({ colorClass }: { colorClass: string }) => (
  <span className="inline-flex items-center gap-0.5">
    <span
      className={`inline-block h-1 w-1 rounded-full ${colorClass} animate-typing-dot`}
      style={{ animationDelay: "0ms" }}
    />
    <span
      className={`inline-block h-1 w-1 rounded-full ${colorClass} animate-typing-dot`}
      style={{ animationDelay: "160ms" }}
    />
    <span
      className={`inline-block h-1 w-1 rounded-full ${colorClass} animate-typing-dot`}
      style={{ animationDelay: "320ms" }}
    />
  </span>
);

export const TypingBubble = ({ role, viewerRole, copy }: TypingBubbleProps) => {
  const own = role === viewerRole;
  const sentByAgent = role === "agent";
  const typingCopy = copy ?? `${sentByAgent ? "Agent" : "Visitor"} is typing`;
  const dotColorClass = "bg-zinc-400 dark:bg-zinc-500";

  return (
    <div className={`flex w-full ${own ? "justify-start" : "justify-end"} px-3`} aria-live="polite">
      <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 pr-2">
        {typingCopy}
        <TypingDots colorClass={dotColorClass} />
      </p>
    </div>
  );
};
