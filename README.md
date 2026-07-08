# AI Mail

A Gmail client where an AI assistant drives the UI directly — composing emails, filling the
compose form live, filtering/searching the inbox, and opening specific messages — instead of
only answering questions in a chat window.

## Features

- **Real Gmail data.** Inbox, Sent, and message detail all read/write through your own Gmail
  account via the Gmail API — nothing is mocked or seeded.
- **AI that controls the UI.** Ask the assistant to draft and send an email, "show me emails
  from the last 10 days", or "open the latest email from David" — it fills the compose form,
  updates the visible list, and navigates the app, not just the chat pane.
- **Human-in-the-loop send.** The assistant never sends an email without an explicit
  confirmation click on an inline card showing exactly what will be sent.
- **Contact resolution.** Say a name instead of an email address ("email John about...") and
  the assistant looks up past correspondence, auto-resolving unambiguous matches and asking
  you to pick when there are several Johns.
- **Tone rewriting.** Rewrite a draft formal/shorter/longer/friendlier, from the Compose page
  or by asking the assistant.
- **New-mail notifications.** Incoming inbox mail shows up without a refresh — a lightweight
  history-diff poll updates the visible list and toasts the sender/subject with a one-click
  Open action.
- **Smart cursor pagination**, glassmorphism UI, dark mode, resizable assistant panel.

## Stack

Next.js 16 (App Router) · TypeScript · Gmail API · Auth.js (Google OAuth) · Postgres (Neon) +
Prisma · CopilotKit + Groq · Tailwind CSS v4 + shadcn/ui · Zustand · SWR

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for how these fit together and the
trade-offs behind each choice.

## Setup

### 1. Prerequisites

- Node.js 20+
- A Postgres database (e.g. a free [Neon](https://neon.tech) project)
- A Google Cloud project with the **Gmail API** enabled and an **OAuth 2.0 Client ID**
  (Web application) — add `http://localhost:3000/api/auth/callback/google` as an authorized
  redirect URI. The OAuth consent screen only needs to be in *Testing* mode; add any Google
  account you'll sign in with as a test user.
- A free [Groq](https://console.groq.com) API key.

### 2. Install

```bash
npm install
```

`postinstall` runs `patch-package` automatically — this applies fixes for two upstream
CopilotKit/AI-SDK bugs (see `patches/`), so no manual step is needed.

### 3. Configure environment

Copy `.env.example` to `.env` and fill in every value:

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `AUTH_SECRET` | `npx auth secret` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console → Credentials |
| `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `GROQ_MODEL` | A current tool-calling-capable model, e.g. `openai/gpt-oss-120b` — check `console.groq.com/docs/models`, model availability rotates |

`GOOGLE_CLOUD_PROJECT_ID` / `GMAIL_PUBSUB_*` can stay blank — they're reserved for a real-time
push-sync pipeline that isn't wired up yet (see [ARCHITECTURE.md](./docs/ARCHITECTURE.md#known-trade-offs--not-implemented)).

### 4. Set up the database

```bash
npx prisma migrate deploy
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google (you'll see an
"unverified app" warning since the OAuth consent screen is in Testing mode — this is expected
for local/eval use), and you're in.

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — stack decisions, request flow, auth/token
  handling, data model, known trade-offs
- [docs/API.md](./docs/API.md) — every REST route and every CopilotKit action, with
  parameters and response shapes
- [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) — color tokens, glassmorphism, icon/
  component conventions

## Project structure

```
app/
  (auth)/login/                 Sign-in page
  (mail)/                       Authenticated shell: sidebar + assistant panel
    inbox/ sent/ compose/ email/[id]/
  api/
    auth/[...nextauth]/         Auth.js
    gmail/{messages,send,contacts}/   Gmail-backed REST routes
    ai/rewrite/                 Tone-rewrite endpoint
    copilotkit/                 CopilotKit runtime (Groq adapter)
components/
  mail/                         Inbox list, filters, pagination, compose form, detail view
  assistant/                    Assistant panel, chat input, action definitions, inline cards
  ui/                           shadcn primitives
hooks/                          useCursorPagination
lib/
  gmail/                        Gmail client, query builder, response mapper, MIME builder
  auth.ts, google-auth.ts, crypto.ts     Auth + token encryption/refresh
  filter-state.ts, compose-store.ts      Shared Zustand stores (assistant + UI both write here)
  api-guard.ts                  requireSession() used by every API route
prisma/schema.prisma            User/Account/Session (Auth.js) + GmailWatch/EmailCache (reserved)
docs/                           Architecture, API, and design-system docs
```
