You are a senior full-stack engineer. Generate the backbone of a MiniCom-style live chat monorepo.

Goal:
Create a production-structured scaffold (not full feature-complete implementation) for:
- standalone visitor app
- standalone agent app
- shared chat core package
- shared chat UI package
- Supabase migration for data model

Tech stack:
- Next.js App Router
- React + Hooks
- Tailwind CSS
- TanStack Query
- TanStack Virtual
- React motion
- Supabase Realtime + Postgres
- pnpm workspace monorepo
- TypeScript strict mode

Repo shape to create:
- apps/visitor
- apps/agent
- packages/chat-core
- packages/chat-ui
- supabase/migrations
- root workspace configs (pnpm workspace, shared tsconfig, scripts)

Required backbone behavior:
1) Visitor app
- Mock landing page with bottom-right chat widget shell
- Thread panel shell with message list shell + composer shell
- Hook structure for thread bootstrap and send flow
- Liveness and typing state placeholders wired to UI status badges

2) Agent app
- Inbox shell with keyboard navigation structure
- Thread shell with message list shell + composer shell
- Thread switching wiring
- Keep thread-scoped state containers to prevent cross-thread contamination

3) Shared chat-core
- Define contracts/interfaces:
  - MessageRepository
  - RealtimeGateway
- Define core types:
  - Thread, Message, MessageCursor, ThreadPage, ThreadLiveMeta
- Add query key helpers:
  - ["thread-messages", threadId]
  - ["thread-live-meta", threadId]
  - ["agent-inbox"]
- Add message merge/sort helpers with deterministic ordering (createdAt, seq, id)
- Add typing controller skeleton with constants:
  - debounce 300ms
  - idle stop 3000ms
  - heartbeat 8000ms
  - ttl 20000ms

4) Shared chat-ui
- MessageBubble primitive
- VirtualizedMessageList primitive using TanStack Virtual
- Include API props for:
  - hasOlder
  - isFetchingOlder
  - onLoadOlder
  - onRetry
  - jump-to-latest state

5) Supabase schema migration
Create migration with:
- threads(id, status, created_at, updated_at)
- thread_participants(thread_id, participant_id, role, last_read_at)
- messages(id, client_id, thread_id, sender_id, sender_role, body, created_at, seq)
- unique(thread_id, client_id)
- index(thread_id, created_at desc, seq desc, id desc)
- trigger/function to bump threads.updated_at on message insert
- add messages table to supabase_realtime publication

6) Testing backbone
Include minimal tests that compile and prove contracts:
- typing debounce timing test
- typing idle stop test
- message merge dedupe/order test
Use placeholders/mocks where full infra is not available.

7) Documentation
Generate README section(s) for:
- local setup
- env vars for both apps
- migration apply command flow
- run/test/build commands
- known TODO markers for full implementation

What NOT to include:
- No auth implementation (JWT/session/OAuth/RLS policy complexity)
- No production deployment setup (Vercel projects/domains)
- No analytics/telemetry vendor integration
- No notification sound system
- No heavy domain-specific UI polish; keep utilitarian baseline UI
- No changing API contracts after defining them
- No runtime hacks that bypass TypeScript strictness

Output requirements:
- Produce complete file tree and code for scaffold files
- Keep everything compiling under strict TS
- Mark intentionally incomplete areas with clear TODO comments
- Ensure `pnpm install`, `pnpm test`, and `pnpm build` can run in scaffold context
- Do not add extra features outside the requested scope
