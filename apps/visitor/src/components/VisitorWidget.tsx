"use client";

import { MessageComposer, RoleIcon, TypingBubble, VirtualizedMessageList } from "@minicom/chat-ui";
import { Motion, spring } from "react-motion";
import React, { useState } from "react";

import { useVisitorChat } from "../hooks/useVisitorChat";

export const VisitorWidget = () => {
  const [open, setOpen] = useState(false);

  const {
    ready,
    isPrimaryTab,
    threadId,
    messages,
    hasOlder,
    isFetchingOlder,
    isClearing,
    unreadCount,
    isAgentTyping,
    isServiceLive,
    isAgentLive,
    sendMessage,
    retryMessage,
    clearConversation,
    onTypingInputChange,
    stopTyping,
    loadOlder,
  } = useVisitorChat({ widgetOpen: open });

  const isSecondaryTab = !isPrimaryTab;

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close support chat" : "Open support chat"}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="cursor-pointer fixed right-5 bottom-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-xl text-white shadow-lg transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:ring-zinc-500"
      >
        <RoleIcon role="visitor" className="h-7 w-7" />
        {!open && unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      <Motion
        defaultStyle={{ opacity: 0, y: 18, scale: 0.97 }}
        style={{
          opacity: spring(open ? 1 : 0, { stiffness: 290, damping: 26 }),
          y: spring(open ? 0 : 18, { stiffness: 280, damping: 25 }),
          scale: spring(open ? 1 : 0.97, { stiffness: 260, damping: 23 }),
        }}
      >
        {(style) => {
          const keepPanelMounted = open || style.opacity > 0.02;

          return (
            <section
              role="dialog"
              aria-modal="true"
              aria-hidden={!open}
              className="fixed right-5 bottom-24 z-20 flex h-[560px] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
              style={{
                opacity: style.opacity,
                transform: `translateY(${style.y}px) scale(${style.scale})`,
                display: keepPanelMounted ? "flex" : "none",
                pointerEvents: open ? "auto" : "none",
                willChange: "opacity, transform",
              }}
            >
              <header className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      MiniCom Support
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Demo chat widget connected to live agent inbox
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500"
                      onClick={() => {
                        void clearConversation();
                      }}
                      disabled={!ready || isClearing || isSecondaryTab}
                    >
                      {isClearing ? "Clearing..." : "Clear"}
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500"
                      onClick={() => {
                        stopTyping();
                        setOpen(false);
                      }}
                      aria-label="Close chat"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      isServiceLive ? "bg-emerald-500" : "bg-zinc-300"
                    }`}
                  />
                  Service {isServiceLive ? "live" : "reconnecting"}
                  <span className="ml-2 inline-flex items-center gap-1">
                    <RoleIcon role="agent" className="h-3.5 w-3.5" />
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        isAgentLive ? "bg-emerald-500" : "bg-zinc-300"
                      }`}
                    />
                    Agent {isAgentLive ? "online" : "away"}
                  </span>
                </div>
                {isSecondaryTab ? (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
                    This chat is active in another tab. This tab is read-only.
                  </p>
                ) : null}
              </header>

              <VirtualizedMessageList
                key={threadId ?? "visitor-thread"}
                ariaLabel="Visitor chat history"
                messages={messages}
                viewerRole="visitor"
                hasOlder={hasOlder}
                isFetchingOlder={isFetchingOlder}
                onLoadOlder={loadOlder}
                onRetry={retryMessage}
              />

              {isAgentTyping ? (
                <div className="pb-2">
                  <TypingBubble role="agent" viewerRole="visitor" />
                </div>
              ) : null}

              <MessageComposer
                ariaLabel="visitor-message-input"
                placeholder={
                  isSecondaryTab
                    ? "This chat is active in another tab."
                    : !ready
                      ? "Connecting..."
                      : isServiceLive
                        ? "Write a message..."
                        : "Reconnecting..."
                }
                disabled={!ready || !isServiceLive || isSecondaryTab}
                onSend={sendMessage}
                onInputChange={onTypingInputChange}
              />
            </section>
          );
        }}
      </Motion>
    </>
  );
};
