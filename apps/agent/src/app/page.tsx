"use client";

import { ThemeToggle } from "@minicom/chat-ui";
import { useState } from "react";

import { InboxList } from "@/components/InboxList";
import { ThreadPanel } from "@/components/ThreadPanel";
import { useAgentInbox } from "@/hooks/useAgentInbox";

export default function AgentHomePage() {
  const { inbox, activeThreadId, setActiveThreadId, isLoading } = useAgentInbox();
  const [isMobileThreadOpen, setIsMobileThreadOpen] = useState(false);

  const handleSelectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setIsMobileThreadOpen(true);
  };

  const handleBackToInbox = () => {
    setActiveThreadId(null);
    setIsMobileThreadOpen(false);
  };

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden px-6 py-8">
      <header className="rounded-2xl border border-white/70 bg-white/70 px-6 py-4 shadow-md backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/75">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-zinc-500 uppercase">
              MiniCom Agent App
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
              Live Inbox
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Standalone agent interface connected to visitor widget through Supabase Realtime.
            </p>
          </div>
        </div>
      </header>

      <section className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div
          className={isMobileThreadOpen ? "hidden lg:block h-full min-h-0" : "block h-full min-h-0"}
        >
          <InboxList
            items={inbox}
            activeThreadId={activeThreadId}
            onSelect={handleSelectThread}
            isLoading={isLoading}
          />
        </div>
        <div className={isMobileThreadOpen ? "block min-h-0" : "hidden min-h-0 lg:block"}>
          <ThreadPanel threadId={activeThreadId} onBackToInbox={handleBackToInbox} />
        </div>
      </section>
      <div className="absolute top-1 right-1">
        <ThemeToggle />
      </div>
    </main>
  );
}
