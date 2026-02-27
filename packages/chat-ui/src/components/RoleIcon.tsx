"use client";

import type { ParticipantRole } from "@minicom/chat-core";

interface RoleIconProps {
  role: ParticipantRole;
  className?: string;
}

export const RoleIcon = ({ role, className }: RoleIconProps) => {
  if (role === "agent") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M4 13a8 8 0 1 1 16 0" />
        <path d="M3 13.5v3a2 2 0 0 0 2 2h1.5v-5.5H5a2 2 0 0 0-2 2Z" />
        <path d="M21 13.5v3a2 2 0 0 1-2 2h-1.5v-5.5H19a2 2 0 0 1 2 2Z" />
        <path d="M9 18.5v1a2.5 2.5 0 0 0 2.5 2.5h1" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
};
