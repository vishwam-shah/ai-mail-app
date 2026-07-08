# Architecture

AI Mail is a Next.js (App Router) full-stack app that renders a Gmail client and layers an
AI assistant on top that can drive the UI directly — filling the compose form, updating the
inbox list, and navigating to specific emails — rather than only replying in a chat pane.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript | Single deployable for UI + API routes; Server Components for the authenticated shell |
| Mail data | Gmail API (`googleapis`) | Real inbox, not a mock — reads/sends live through the user's own Gmail account |
| Auth | Auth.js (NextAuth v5) + Google OAuth, database sessions | `gmail.modify`/`gmail.send` scopes come from the same OAuth consent as sign-in |
| Database | Postgres (Neon) via Prisma 7 | Stores accounts/sessions only — mail itself is never persisted (see [Data model](#data-model)) |
| AI orchestration | CopilotKit (`react-core` + `react-ui` + `runtime`) | `useCopilotAction`/`useCopilotReadable` let the model call real handlers that mutate app state, not just produce text |
| LLM | Groq (`GroqAdapter`), model pinned via `GROQ_MODEL` env var | Fast, free-tier-friendly, OpenAI-compatible tool-calling |
| Client state | Zustand (`filter-state`, `compose-store`) + SWR (server data) | Filters/compose draft are UI state the assistant must be able to write to directly; SWR owns anything that came from an API call |
| Styling | Tailwind CSS v4 + shadcn/ui (`base-nova`, on `@base-ui/react`) | Custom glassmorphism theme layered on shadcn's primitives — see [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Icons | Remix Icon (`@remixicon/react`) | One icon set across all app-authored code |

## Request flow

```
Browser
  │
  ├─ Server Components (app/(mail)/layout.tsx, page.tsx)
  │     └─ auth() → redirects to /login if no session
  │
  ├─ Client components (EmailList, ComposeForm, ...)
  │     └─ SWR → /api/gmail/*  ─────────────┐
  │                                          │
  └─ AssistantPanel (CopilotChat)            │
        └─ POST /api/copilotkit              │
              └─ CopilotRuntime + GroqAdapter │
                    └─ tool call ──────────────────┐
                                                     ▼
                                    AssistantActions.tsx (useCopilotAction handlers)
                                        - navigates via next/navigation
                                        - writes Zustand stores (filters, compose draft)
                                        - calls the SAME /api/gmail/* routes the UI uses
                                                     │
                                                     ▼
                                          lib/gmail/client.ts → googleapis → Gmail API
```

The important property: **the assistant and the plain UI go through the same code paths.**
`searchEmails` writes to `useFilterStore`, exactly what `FilterBar` writes to; `EmailList`'s
SWR subscription re-fetches either way. `sendComposedEmail` posts to `/api/gmail/send`,
the same route the Compose page's Send button calls. There is no separate "AI mode" data
path to keep in sync with the human one.

## Auth & token handling

- Auth.js Google provider requests `access_type=offline&prompt=consent` so a refresh token
  is issued on every consent grant, not just the first.
- OAuth access/refresh tokens are encrypted at the application layer (`lib/crypto.ts`,
  AES-256-GCM with a 32-byte key from `TOKEN_ENCRYPTION_KEY`) before Prisma ever writes them
  to `Account.access_token`/`refresh_token`. They're decrypted only inside
  `lib/google-auth.ts`, on demand, never exposed through the session object.
- `getGoogleAccessToken()` (`lib/google-auth.ts`) checks token expiry on every call and
  transparently refreshes (and re-encrypts, re-persists) when the access token is within 60s
  of expiring. Callers never handle refresh themselves.
- Every API route that touches Gmail or the LLM goes through `requireSession()`
  (`lib/api-guard.ts`) — a single helper that checks for a valid session and returns a 401
  `NextResponse` if there isn't one, instead of each route re-implementing that check.

## Data model

Mail is **not** cached in Postgres. Inbox/Sent/Detail/Search all render live from the Gmail
API on every request. Prisma only owns:

- `User`, `Account`, `Session`, `VerificationToken` — Auth.js's own tables (via
  `@auth/prisma-adapter`), holding the encrypted OAuth tokens.
- `GmailWatch`, `EmailCache` — modeled for a `users.watch()` + Cloud Pub/Sub push-sync
  pipeline (register a watch, receive history-diff webhooks, reconcile into a cache table).
  **This pipeline is not wired up in the current build** — no watch-registration route,
  webhook route, or cron renewal exists yet, and both tables are unused. Live-feeling data is
  achieved more simply today: SWR re-fetches on navigation/mutation (e.g. right after a send),
  and there's no cross-tab/server push. Wiring the watch→Pub/Sub→webhook→reconcile loop
  against these two tables is the natural next step if true push sync (a new email appearing
  without any user action) is required.

Why live-from-Gmail instead of cache-then-render: it avoids an entire class of staleness bugs
(cache says read, Gmail says unread) under a tight build timeline, at the cost of a network
round trip per view. `EmailList`'s SWR config (`dedupingInterval: 60_000`,
`revalidateOnFocus: false`) keeps repeat views of the same query near-instant without a
database in the loop.

## Pagination

Gmail's `messages.list` is cursor-paginated (`pageToken`/`nextPageToken`) — there's no
"jump to page 7". `hooks/useCursorPagination.ts` makes cursor pagination feel like numbered
pagination in the UI: it remembers every token it has seen for the current query, so
revisiting a previously-seen page is an instant, direct fetch by its known token, while moving
past the last known page still requires the token Gmail just returned. The hook resets
(back to page 1, tokens cleared) whenever its `resetKey` — the built query string — changes,
using React's "adjust state during render" pattern rather than a `useEffect`, so the reset is
part of the same render pass instead of committing stale state and re-rendering a beat later.

## AI action layer

All `useCopilotReadable`/`useCopilotAction` definitions live in one place,
`components/assistant/AssistantActions.tsx`, mounted once in the `(mail)` layout so it stays
active across every page. See [API.md](./API.md#copilotkit-actions) for the full action
inventory and parameters. Two design points worth calling out:

- **Human-in-the-loop via `renderAndWaitForResponse`.** `sendComposedEmail` and
  `resolveContact` don't execute immediately — they render an inline card
  (`ConfirmSendCard`, `ContactPickerCard`) and pause the tool call until the user clicks
  something. Both renderers guard against the card unmounting before the user responds
  (navigation, closing the chat) with a ref-guarded `respond()` call in a cleanup effect —
  without that guard, an abandoned tool call permanently breaks the next message in that
  thread (`AI_MissingToolResultsError`).
- **Contact resolution auto-resolves when it can.** `resolveContact` looks up past
  correspondence; if there's exactly one match (or zero) it calls `respond()` itself from a
  `useEffect`, no UI shown. The picker card only renders — and only then does a human have to
  click anything — when there's real ambiguity.

## Known trade-offs / not implemented

- **No real-time push sync.** See [Data model](#data-model) above — `GmailWatch`/`EmailCache`
  are scaffolded but not wired to a Pub/Sub webhook. New mail appears on next navigation/manual
  refresh, not automatically.
- **`/api/copilotkit` is gated by session but not per-user-scoped beyond that** — the Groq
  system prompt and tool definitions are the same for every user; nothing here is
  multi-tenant-sensitive since the runtime itself doesn't touch Gmail directly (the action
  handlers do, using the caller's own session).
