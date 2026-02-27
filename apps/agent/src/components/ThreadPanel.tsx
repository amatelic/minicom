"use client";

import { MessageComposer, RoleIcon, VirtualizedMessageList } from "@minicom/chat-ui";

import { useAgentThread } from "@/hooks/useAgentThread";

interface ThreadPanelProps {
  threadId: string | null;
  onBackToInbox?: () => void;
}

export const ThreadPanel = ({ threadId, onBackToInbox }: ThreadPanelProps) => {
  const {
    messages,
    hasOlder,
    isFetchingOlder,
    isVisitorTyping,
    isServiceLive,
    isVisitorLive,
    sendMessage,
    retryMessage,
    onTypingInputChange,
    loadOlder,
  } = useAgentThread(threadId);

  if (!threadId) {
    return (
      <section className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Select a conversation
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Visitor threads appear in the inbox on the left.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBackToInbox ? (
              <button
                type="button"
                aria-label="Back to inbox"
                className="cursor-pointer inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:focus-visible:ring-zinc-500 lg:hidden"
                onClick={onBackToInbox}
              >
                Back
              </button>
            ) : null}
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Conversation {threadId.slice(0, 8)}
            </h2>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isServiceLive ? "bg-emerald-500" : "bg-zinc-300"
            }`}
          />
          Service {isServiceLive ? "live" : "reconnecting"}
          <span className="ml-2 inline-flex items-center gap-1">
            <RoleIcon role="visitor" className="h-3.5 w-3.5" />
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isVisitorLive ? "bg-emerald-500" : "bg-zinc-300"
              }`}
            />
            Visitor {isVisitorLive ? "online" : "away"}
          </span>
        </div>
        {isVisitorTyping ? (
          <p className="mt-1 pb-2 text-xs text-zinc-500 dark:text-zinc-400">Visitor is typing...</p>
        ) : null}
      </header>

      <VirtualizedMessageList
        key={threadId}
        ariaLabel="Agent thread history"
        messages={messages}
        viewerRole="agent"
        hasOlder={hasOlder}
        isFetchingOlder={isFetchingOlder}
        onLoadOlder={loadOlder}
        onRetry={retryMessage}
      />

      <MessageComposer
        ariaLabel="agent-message-input"
        placeholder="Reply to visitor..."
        disabled={!threadId}
        onSend={(value) => {
          void sendMessage(value);
        }}
        onInputChange={onTypingInputChange}
      />
    </section>
  );
};
