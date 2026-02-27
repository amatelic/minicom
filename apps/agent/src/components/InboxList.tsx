"use client";

import type { InboxThread } from "@minicom/chat-core";
import { RoleIcon } from "@minicom/chat-ui";
import React, { useRef } from "react";

import { useListKeyboardNavigation } from "@/hooks/useListKeyboardNavigation";

const formatTime = (timestamp: number): string => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
};

const truncate = (value: string, maxLength = 86): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
};

interface InboxListProps {
  items: InboxThread[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void;
  isLoading?: boolean;
}

export const InboxList = ({ items, activeThreadId, onSelect, isLoading }: InboxListProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { focusedIndex, handleKeyDown, handleFocus, handleItemClick, handleItemMouseEnter } =
    useListKeyboardNavigation<InboxThread>({
      items,
      activeId: activeThreadId,
      getItemId: (item) => item.thread.id,
      onSelect,
      itemRefs,
    });

  if (isLoading) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inbox</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sorted by unread first, then recent.
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" />
                  <div className="h-4 w-24 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" />
                </div>
                <div className="h-3 w-12 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" />
              </div>
              <div className="mt-1 h-3 w-3/4 rounded bg-zinc-200 animate-pulse dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inbox</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sorted by unread first, then recent.
          </p>
        </header>
        <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">No open conversations.</p>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inbox</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Sorted by unread first, then recent.
        </p>
      </header>

      <ul
        ref={listRef}
        aria-label="Agent inbox list"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto outline-none"
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {items.map((item, index) => {
          const isActive = item.thread.id === activeThreadId;
          const isFocused = index === focusedIndex;
          const unread = item.unreadCount;

          return (
            <li key={item.thread.id}>
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                className={`w-full border-b border-zinc-200 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:focus-visible:ring-zinc-500 ${
                  isActive
                    ? "bg-sky-50 dark:bg-sky-900/35"
                    : isFocused
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                } ${isActive ? "ring-1 ring-sky-200 dark:ring-sky-700/70" : isFocused ? "ring-1 ring-zinc-300 dark:ring-zinc-600" : ""}`}
                onClick={() => handleItemClick(index, item.thread.id)}
                onMouseEnter={() => handleItemMouseEnter(index)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      isActive
                        ? "text-sky-700 dark:text-sky-200"
                        : isFocused
                          ? "text-zinc-800 dark:text-zinc-200"
                          : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    <RoleIcon
                      role="visitor"
                      className={`h-4 w-4 ${isActive ? "text-sky-600 dark:text-sky-300" : isFocused ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-500 dark:text-zinc-300"}`}
                    />
                    Conversation {item.thread.id.slice(0, 8)}
                    {unread > 0 && !isActive ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                        {unread > 99 ? "99+" : unread} unread
                      </span>
                    ) : null}
                  </p>
                  <span
                    className={`text-xs ${isActive ? "text-sky-600 dark:text-sky-300" : isFocused ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-500 dark:text-zinc-400"}`}
                  >
                    {formatTime(item.thread.updatedAt)}
                  </span>
                </div>
                <p
                  className={`mt-1 text-xs ${
                    isActive
                      ? "text-sky-700/80 dark:text-sky-200/80"
                      : isFocused
                        ? "text-zinc-600/80 dark:text-zinc-300/80"
                        : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {item.lastMessage ? truncate(item.lastMessage.body) : "No messages yet"}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
