# MiniCom App Skill

## Purpose
Use this skill to operate, debug, and extend the MiniCom dual-app chat system end-to-end without re-discovering architecture decisions.

Use this skill when you need to:
- run the visitor and agent apps locally
- apply database schema changes required for chat
- debug message delivery, typing indicators, or liveness issues
- add features while preserving core delivery and ordering guarantees

Do not use this skill for:
- infra deployment specifics (Vercel project setup, DNS, secrets manager policies)
- production auth and RBAC design beyond the documented demo assumptions
- non-chat product areas unrelated to `apps/visitor`, `apps/agent`, `packages/chat-core`, and `packages/chat-ui`

Source-of-truth files:
- `README.md`
- `apps/visitor/src/app/page.tsx`
- `apps/agent/src/app/page.tsx`
- `packages/chat-core/src/index.ts`

## Quick Start
1. Ensure runtime/tooling is available.
- Node: `>=22 <23` (from root `package.json` engines)
- pnpm: `8.15.1`

2. Install dependencies.
```bash
cd /Users/anzematelic/indi/bitstarz
pnpm install
```

3. Configure env vars in both apps.
```bash
# /Users/anzematelic/indi/bitstarz/apps/visitor/.env.local
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# /Users/anzematelic/indi/bitstarz/apps/agent/.env.local
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. Apply migration in order.
- Migration file path:
`/Users/anzematelic/indi/bitstarz/supabase/migrations/20260225163000_minicom_chat_schema.sql`

Recommended CLI flow:
```bash
cd /Users/anzematelic/indi/bitstarz
supabase login
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Fallback SQL flow:
- Open Supabase SQL Editor.
- Run entire file `supabase/migrations/20260225163000_minicom_chat_schema.sql`.

5. Run the apps.
```bash
cd /Users/anzematelic/indi/bitstarz
pnpm dev
```

6. Direct app commands.
```bash
pnpm dev:visitor
pnpm dev:agent
```

7. Test and build.
```bash
pnpm test
pnpm build
```

If your local Node version does not satisfy engines, run with an engine-strict override while debugging:
```bash
pnpm --config.engine-strict=false test
pnpm --config.engine-strict=false build
```

Source-of-truth files:
- `package.json`
- `pnpm-workspace.yaml`
- `supabase/migrations/20260225163000_minicom_chat_schema.sql`
- `packages/chat-core/src/supabase/client.ts`

## Repository Map
- `apps/visitor`
- Responsibility: mock website + bottom-right chat widget runtime and UI.
- Key entry files: `apps/visitor/src/app/page.tsx`, `apps/visitor/src/components/VisitorWidget.tsx`, `apps/visitor/src/hooks/useVisitorChat.ts`.

- `apps/agent`
- Responsibility: inbox list + thread panel for support agent operations.
- Key entry files: `apps/agent/src/app/page.tsx`, `apps/agent/src/components/InboxList.tsx`, `apps/agent/src/components/ThreadPanel.tsx`, `apps/agent/src/hooks/useAgentThread.ts`.

- `packages/chat-core`
- Responsibility: contracts, data types, Supabase adapters, liveness/typing logic, merge/query helpers.
- Key entry files: `packages/chat-core/src/protocol.ts`, `packages/chat-core/src/types.ts`, `packages/chat-core/src/supabase/repository.ts`, `packages/chat-core/src/supabase/realtimeGateway.ts`, `packages/chat-core/src/liveness.ts`, `packages/chat-core/src/hooks/typingController.ts`.

- `packages/chat-ui`
- Responsibility: shared message rendering primitives and virtualized list behavior.
- Key entry files: `packages/chat-ui/src/components/MessageBubble.tsx`, `packages/chat-ui/src/components/VirtualizedMessageList.tsx`.

- `supabase/migrations`
- Responsibility: schema and index definitions for chat persistence and realtime message publication.
- Key entry file: `supabase/migrations/20260225163000_minicom_chat_schema.sql`.

Source-of-truth files:
- `README.md`
- `apps/*/src/**/*`
- `packages/chat-core/src/**/*`
- `packages/chat-ui/src/**/*`

## System Architecture
Visitor flow:
1. Open widget from marketing page.
2. `useVisitorChat` reads/creates visitor identity from localStorage (`minicom:visitor-id`).
3. `ensureThread` resolves existing thread or creates one and stores thread id (`minicom:thread-id`).
4. User sends message.
5. UI inserts optimistic message (`deliveryState: sending`).
6. Repository `sendMessage` upserts canonical DB row.
7. Realtime insert event and local merge reconcile optimistic/canonical states.
8. Retry path reuses same `clientId` for idempotent upsert semantics.

Agent flow:
1. `useAgentInbox` fetches open threads with unread counts and last message preview.
2. Keyboard and pointer selection set active thread in inbox.
3. `useAgentThread` subscribes to `thread:{threadId}` channel and loads paged history.
4. Agent replies with optimistic send and canonical DB upsert.
5. Visitor receives insert via realtime channel.

Shared flow:
1. Both apps use TanStack Query for server-state caching and pagination.
2. Both apps merge paged data + realtime inserts + optimistic messages via `mergeMessages`.
3. Message ordering is deterministic by `(createdAt, seq, id)`.
4. Duplicate suppression happens by message `id` with sent-state preference.

Failure mode example:
- Scenario: same message appears in page payload and realtime insert.
- Protection: `mergeMessages` dedupes by `id` and keeps stable sort order, preventing duplicate rows.

Source-of-truth files:
- `apps/visitor/src/hooks/useVisitorChat.ts`
- `apps/agent/src/hooks/useAgentInbox.ts`
- `apps/agent/src/hooks/useAgentThread.ts`
- `packages/chat-core/src/utils/messages.ts`

## Data Contracts (Source of Truth)
Message identity contract:
- `id`: canonical server message identifier
- `clientId`: client-generated idempotency key
- `threadId`: conversation identifier
- `createdAt`: primary logical time
- `seq`: database sequence tie-breaker
- `deliveryState`: `sending | sent | failed` UI delivery state

Repository contract (`MessageRepository`):
- `ensureThread({ threadId?, visitorId, agentId })`
- Semantics: if `threadId` exists, fetch it; otherwise create thread + participant rows.

- `fetchThreadPage({ threadId, cursor, limit })`
- Semantics: cursor pagination ordered by `created_at desc, seq desc, id desc`; returns `{ items, nextCursor }`.

- `sendMessage({ threadId, clientId, senderId, senderRole, body, createdAt })`
- Semantics: upsert on `(thread_id, client_id)` for idempotent retries; returns canonical message row.

- `markThreadRead({ threadId, participantId, at })`
- Semantics: writes `last_read_at` for participant.

- `fetchAgentInbox({ agentId })`
- Semantics: returns open threads, last message preview, unread count sorted by unread then recent.

Realtime gateway contract (`RealtimeGateway`):
- `connectThread(threadId)` joins `thread:{threadId}`.
- `sendMessage(payload)` broadcasts message payload metadata.
- `setTyping(payload)` broadcasts typing updates.
- `publishHeartbeat(payload)` uses presence track metadata.
- `subscribe(handler)` streams `message.inserted`, `typing.updated`, `heartbeat`, `channel.status`.

Query keys:
- Thread messages: `["thread-messages", threadId]`
- Thread live metadata: `["thread-live-meta", threadId]`
- Agent inbox: `["agent-inbox"]`

Delivery state semantics:
- `sending`: optimistic client state before canonical confirmation.
- `sent`: canonical row exists and merged.
- `failed`: send failed; retry should reuse `clientId`.

Failure mode example:
- Scenario: send is retried after timeout.
- Protection: unique `(thread_id, client_id)` guarantees one canonical row; retries converge.

Source-of-truth files:
- `packages/chat-core/src/types.ts`
- `packages/chat-core/src/protocol.ts`
- `packages/chat-core/src/queryKeys.ts`
- `packages/chat-core/src/supabase/repository.ts`

## Realtime, Typing, and Liveness Behavior
Liveness constants:
- Heartbeat interval: `8000ms`
- Heartbeat TTL: `20000ms`
- Service live requires all:
- browser online
- channel status `SUBSCRIBED`
- latest heartbeat age `<= 20s`

Typing constants:
- Debounce before first `typing=true`: `300ms`
- Idle timeout for `typing=false`: `3000ms`
- Refresh while active typing: `1200ms`

Typing gating rules:
- If `canEmit` is false, typing signals are suppressed.
- If `setCanEmit(false)` occurs, typing controller force-stops and emits `typing=false` once if possible.
- Empty input force-stops typing immediately.

Reconnect expectations:
1. On reconnect, channel transitions through statuses until `SUBSCRIBED`.
2. Heartbeats repopulate presence metadata.
3. `canEmit` becomes true only when liveness checks pass again.
4. Typing remains suppressed until then.

Failure mode example:
- Scenario: laptop goes offline while user is typing.
- Protection: `canEmit` flips false through liveness path; controller force-clears typing state.

Source-of-truth files:
- `packages/chat-core/src/liveness.ts`
- `packages/chat-core/src/hooks/typingController.ts`
- `packages/chat-core/src/hooks/useTypingSignal.ts`
- `apps/visitor/src/hooks/useVisitorChat.ts`
- `apps/agent/src/hooks/useAgentThread.ts`

## Virtualized History + Pagination
Pagination model:
1. Use `useInfiniteQuery` with thread-scoped key.
2. Page fetch uses `fetchThreadPage` cursor API.
3. `getNextPageParam` uses `nextCursor` from last page.

Top-threshold auto-fetch:
- Virtualized list checks `scrollTop <= 120px` and triggers `onLoadOlder()` once while fetch is active.

Prepend anchor preservation:
1. Before fetching older messages, record previous scroll height.
2. After prepend, apply delta to `scrollTop`.
3. Visible content remains anchored instead of jumping.

Bottom follow behavior:
- If user is near bottom (`<= 80px`), new messages auto-scroll to latest.
- If user is not near bottom, preserve position and show `Jump to latest`.

Dedupe and overlap merge:
- Merge paged + realtime + optimistic sets with `mergeMessages`.
- Deduplication by `id`.
- Deterministic sort by `(createdAt, seq, id)`.

Failure mode example:
- Scenario: user scrolls up while new messages arrive.
- Behavior: no forced jump; `Jump to latest` button appears and user controls repositioning.

Source-of-truth files:
- `packages/chat-ui/src/components/VirtualizedMessageList.tsx`
- `packages/chat-core/src/utils/messages.ts`
- `apps/visitor/src/hooks/useVisitorChat.ts`
- `apps/agent/src/hooks/useAgentThread.ts`

## Conversation Correctness Rules
Enforce these rules in all changes:
1. Never write optimistic or realtime updates to the wrong thread.
2. Keep agent-side optimistic state scoped per thread.
3. Keep agent-side realtime cache scoped per thread.
4. Capture `targetThreadId` at send start and use it for the full async lifecycle.
5. Always reuse `clientId` on retry to keep idempotency.

Current implementation details:
- `optimisticByThread[threadId][clientId]` for agent optimistic writes.
- `realtimeByThread[threadId]` for agent realtime inserts.
- `removeOptimistic(current, threadId, clientId)` removes only thread-local optimistic entry.
- `sendInternal` captures `targetThreadId` before awaiting network operations.

Failure mode example:
- Scenario: agent sends in thread A, switches to thread B before request resolves.
- Protection: all completion handlers write back to `targetThreadId` (thread A), preventing cross-thread bleed.

Source-of-truth files:
- `apps/agent/src/hooks/useAgentThread.ts`
- `packages/chat-core/src/supabase/repository.ts`
- `packages/chat-core/src/utils/messages.ts`

## Accessibility and UX Guarantees
Inbox accessibility:
- Inbox list has `aria-label="Agent inbox list"`.
- Keyboard navigation:
- `ArrowDown` moves focus index down.
- `ArrowUp` moves focus index up.
- `Enter` selects focused thread.

Message history accessibility:
- Message containers use `role="log"` and `aria-live="polite"`.
- Separate labels for visitor and agent logs.

Composer behavior:
- `Enter` sends message.
- `Shift+Enter` inserts newline.
- Inputs expose labels via `ariaLabel`/associated id.

Fallback UX:
- Error boundary in both apps to prevent full crash loop.
- Offline banner displayed when browser offline.

Failure mode example:
- Scenario: no conversations in inbox.
- Behavior: explicit empty-state section renders and keyboard handling does not throw.

Source-of-truth files:
- `apps/agent/src/components/InboxList.tsx`
- `apps/agent/src/components/ThreadPanel.tsx`
- `apps/visitor/src/components/VisitorWidget.tsx`
- `apps/*/src/components/MessageComposer.tsx`
- `apps/*/src/components/ErrorBoundary.tsx`

## Troubleshooting Runbook
Use this format: Symptom -> Likely cause -> Check -> Fix.

1. Message appears in wrong thread (agent).
- Likely cause: thread scoping regression in `useAgentThread`.
- Check: verify `sendInternal` uses captured `targetThreadId` and state maps are keyed by thread.
- Fix: restore thread-scoped buffers (`optimisticByThread`, `realtimeByThread`) and thread-local reconciler path.

2. Typing indicator is stuck on.
- Likely cause: `canEmit` not transitioning false on liveness/offline, or force stop not called on empty input.
- Check: inspect `createTypingController` (`setCanEmit`, `forceStop`, idle timer).
- Fix: ensure `setCanEmit(false)` path emits `typing=false`; ensure composer sends `onInputChange("")` after send.

3. UI stays on "Service reconnecting".
- Likely cause: missing/failing heartbeat or channel not `SUBSCRIBED`.
- Check: inspect live meta (`channel.status`, latest heartbeat age, online flag).
- Fix: verify channel joins `thread:{threadId}`; verify `publishHeartbeat` interval is active and not blocked.

4. Agent inbox shows no messages.
- Likely cause: migration missing, wrong env vars, or agent participant mismatch.
- Check: ensure tables exist; verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; verify agent id is `agent-demo` in inbox query path.
- Fix: apply migration; correct env files in both apps; restart dev servers.

5. Migration/schema mismatch errors.
- Likely cause: SQL not applied or partial apply.
- Check: validate existence of `threads`, `thread_participants`, `messages`, unique `(thread_id, client_id)`, and index `messages_thread_cursor_idx`.
- Fix: run `supabase db push` or execute migration SQL file end-to-end in SQL Editor.

6. Env var misconfiguration.
- Likely cause: missing app-specific `.env.local` values.
- Check: `createSupabaseBrowserClient` throws if vars are missing.
- Fix: set vars in both `apps/visitor/.env.local` and `apps/agent/.env.local`, then restart.

Subsystem failure example (data layer):
- Scenario: duplicate message records when network retries happen.
- Check: confirm unique constraint `(thread_id, client_id)` exists.
- Fix: reapply migration and verify upsert `onConflict: "thread_id,client_id"` remains unchanged.

Source-of-truth files:
- `packages/chat-core/src/hooks/typingController.ts`
- `packages/chat-core/src/liveness.ts`
- `packages/chat-core/src/supabase/repository.ts`
- `packages/chat-core/src/supabase/client.ts`
- `apps/agent/src/hooks/useAgentThread.ts`
- `supabase/migrations/20260225163000_minicom_chat_schema.sql`

## Validation Checklist
End-to-end local verification:
1. Start both apps with valid Supabase env vars.
2. Open visitor app at `http://localhost:3000`.
3. Open agent app at `http://localhost:3001`.
4. Send visitor message and confirm thread appears in agent inbox.
5. Open thread in agent, reply, and confirm visitor receives it.
6. Type in agent and visitor to verify typing indicator appears after debounce and clears after inactivity.
7. Scroll up in long thread and verify `Jump to latest` behavior and anchor-preserved prepends.

Command checklist:
```bash
cd /Users/anzematelic/indi/bitstarz
pnpm test
pnpm build
pnpm dev
```

Manual acceptance checklist:
- Cross-app message relay works both directions.
- No duplicate rows when paging and realtime overlap.
- No cross-thread bleed when sending then switching threads.
- Typing obeys `300ms` debounce and `3s` idle stop.
- Service and participant liveness indicators transition correctly.
- Inbox keyboard navigation works with Arrow keys and Enter.

Source-of-truth files:
- `README.md`
- `packages/chat-core/src/hooks/useTypingSignal.test.tsx`
- `packages/chat-core/src/liveness.test.ts`
- `packages/chat-core/src/utils/messages.test.ts`

## Extension Recipes
Add auth later:
1. Replace demo identities (`agent-demo`, generated visitor id) with real auth subject ids.
2. Add RLS policies for thread/message access by participant membership.
3. Thread bootstrap should bind participant ids from auth context.
4. Update `fetchAgentInbox` to query by authenticated agent id.

Add sound/notifications:
1. Add notification preference state in app layer.
2. Trigger sound only for remote unread inserts and only when tab visibility rules allow.
3. Keep sound side effects outside `chat-core` contracts.

Add read-receipt UI:
1. Extend UI models to include participant read timestamps from `thread_participants.last_read_at`.
2. Render per-message receipt based on sender/receiver read timestamps.
3. Keep repository contract unchanged unless additional fields are needed.

Add E2E coverage:
1. Add Playwright with two browser contexts (visitor + agent).
2. Script cross-app send/typing/liveness transitions.
3. Add regression test for thread-switch send correctness.

Source-of-truth files:
- `apps/visitor/src/hooks/useVisitorChat.ts`
- `apps/agent/src/hooks/useAgentInbox.ts`
- `apps/agent/src/hooks/useAgentThread.ts`
- `packages/chat-core/src/protocol.ts`
- `supabase/migrations/20260225163000_minicom_chat_schema.sql`

## Known Limitations
- Identities are demo-only in this phase.
- Visitor id is anonymous localStorage session (`minicom:visitor-id`).
- Agent identity is fixed (`agent-demo`).
- No production auth or RLS policy layer is documented in this skill.
- Message canonical state is database-backed; local state is optimistic/cache only.
- Presence heartbeat is challenge-scope liveness, not guaranteed SLA-level uptime signal.
- Tests currently cover core contracts and timing logic; cross-app browser E2E is not yet added.

Source-of-truth files:
- `README.md`
- `apps/visitor/src/lib/ids.ts`
- `apps/agent/src/lib/runtime.ts`
- `packages/chat-core/src/hooks/useTypingSignal.test.tsx`
