import { ThemeToggle } from "@minicom/chat-ui";

import { VisitorWidget } from "@/components/VisitorWidget";

export default function VisitorHomePage() {
  const content = [
    "Realtime visitor to agent relay",
    "Debounced typing with liveness gating",
    "Virtualized thread with old-message paging",
  ];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <div className="absolute top-1 right-1">
        <ThemeToggle />
      </div>

      <section className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-xl backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-900/75">
        <p className="text-xs font-semibold tracking-[0.24em] text-zinc-500 uppercase">
          Mock Website
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-900 dark:text-zinc-100">
          Acme Cloud Analytics
        </h1>
        <p className="mt-4 max-w-2xl text-zinc-600 dark:text-zinc-300">
          This page simulates a production marketing site. The bottom-right chat widget is connected
          to a standalone agent app through Supabase Realtime.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {content.map((item) => (
          <article
            key={item}
            className="rounded-2xl border border-white/70 bg-white/60 p-5 shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/70"
          >
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Challenge requirement wired in this prototype; open the widget and start a
              conversation.
            </p>
          </article>
        ))}
      </section>

      <VisitorWidget />
    </main>
  );
}
