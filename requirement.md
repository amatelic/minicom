Frontend Coding Challenge: MiniCom - Live Chat Support Demo (Revised)

Tech Stack:
- React (Hooks + Context or Zustand)
- Next.js (App Router)
- Tailwind CSS

Scenario
You are building a live customer support system, similar to Intercom or Drift.

Goal
Build a MiniCom prototype that demonstrates realtime chat, scalable UI, and clean architecture.

Visitor App Requirements (Mock Website)
1) A mock website with a chat widget that opens from a bottom-right button.
2) A visitor can start a conversation via the chat widget.
3) Chat interface with:
   - Message bubbles
   - Scrollable history
   - Auto-scroll on new message

Agent App Requirements (Standalone App)
1) Agent inbox with:
   - All open conversations
   - Unread counts
   - Last message preview
   - Sort by recent and unread
2) Thread view where the agent can open a conversation and respond.

Shared Requirements
1) Cross-app messaging
   - Visitor messages appear in the agent app inbox
   - Agent responses are delivered back to the visitor chat widget
2) Realtime constraints
   - Optimistic send
   - Retry on failure
   - Out-of-order message handling
   - Delivery states: sending, sent, failed
   - Realtime transport can be simulated (BroadcastChannel, localStorage events, polling) or implemented via a managed service (Firebase/Supabase)
3) Presence and typing indicators
   - Simulated is OK
   - Debounced updates
4) Data model
   - Define thread, participant, message, metadata
   - Include timestamps, status, read receipts
5) Accessibility
   - Keyboard navigation for input and inbox list (agent app)
   - Visible focus states
   - ARIA labels for key controls
6) Performance
   - Virtualized list OR lazy rendering for long histories
7) Tests (minimum 3)
   - One UI interaction
   - One state transition
   - One edge case
8) Resilience
   - Error boundary or offline banner
   - Defined fallback behavior
9) Responsive UI using Tailwind CSS.
10) Clean code, reusable components (atomic design or component library is OK), and a clear folder structure.

Bonus Points
- Persist threads (localStorage or backend)
- Notification badge or sound on new message
- Dark mode toggle

AI Usage (Allowed)
This challenge is AI-friendly. If you use AI tools, document it clearly.

README Requirements
- Project overview
- Architecture diagram (text is fine)
- State management choices and trade-offs
- How AI helped (include example prompts and what you edited)
- Improvements you would make with more time

Submission Checklist
- GitHub repo link
- Live demo link (Vercel, Netlify, etc.)
- README.md with all required sections
