# API Reference

All routes below live under `app/api/`, are Next.js Route Handlers, and (except
`/api/auth/*`, handled entirely by Auth.js) start with `const { session, error } = await
requireSession(); if (error) return error;` — see `lib/api-guard.ts`. Unauthenticated
requests get `401 { "error": "Unauthorized" }` from every one of them.

## REST routes

### `GET /api/gmail/messages`

Lists a page of the signed-in user's Inbox or Sent mail, translated from a Gmail search query.

**Query params**

| Param | Type | Notes |
|---|---|---|
| `view` | `"inbox" \| "sent"` | Defaults to `inbox` |
| `pageToken` | `string` | Gmail's opaque cursor; omit for page 1 |
| `dateFrom`, `dateTo` | `yyyy-mm-dd` | Mapped to Gmail's `after:`/`before:` |
| `sender` | `string` | Mapped to `from:` |
| `keyword` | `string` | Quoted and appended as a bare search term |
| `readStatus` | `"all" \| "unread" \| "read"` | Mapped to `is:unread`/`is:read` |

Query construction lives in `lib/gmail/queries.ts#buildGmailQuery` and sanitizes free-text
values (strips `"`/newlines) so a filter value can't inject extra Gmail search operators.

**Response**

```json
{ "messages": [EmailSummary, ...], "nextPageToken": "string | null" }
```

`EmailSummary` (`lib/gmail/mapper.ts`): `id, threadId, from, fromName, to[], subject, snippet,
date (ISO), isUnread, labelIds[]`.

Fetches 50 messages per page (`PAGE_SIZE`), with per-message detail fetches bounded to 10
concurrent in-flight requests (`DETAIL_FETCH_CONCURRENCY` in `mapWithConcurrency`) to stay
comfortably under Gmail's per-user quota rather than firing 50 requests at once.

### `GET /api/gmail/messages/[id]`

Full detail for one message (`format=full`), MIME-parsed. Returns `EmailDetailData` — an
`EmailSummary` plus `cc[]`, `bodyText`, `bodyHtml` (`lib/gmail/mapper.ts#extractBodies` walks
multipart payloads and skips attachment parts). Subject/From headers are RFC 2047-decoded and
HTML-entity-decoded so encoded/garbled characters render correctly.

### `POST /api/gmail/send`

Sends an email as the signed-in user.

**Body** (validated with Zod, `sendSchema`)

```ts
{ to: string; subject: string; body: string; threadId?: string; inReplyTo?: string; references?: string }
```

`threadId`/`inReplyTo`/`references` are optional and used for replies, so the sent message
threads correctly in Gmail. Builds a raw RFC 2822 message (`lib/gmail/mime.ts`) and calls
`gmail.users.messages.send`.

**Response**: `{ id: string, threadId: string }`

### `GET /api/gmail/contacts?q=<name>`

Resolves a name to real email addresses by scanning the From/To headers of up to 20 recent
messages matching `{from:"<name>" to:"<name>"}`. Used by the `resolveContact` assistant action
so the model never has to guess an email address from a first name.

**Response**: `{ contacts: [{ name: string, email: string }, ...] }` — capped at 6, deduped by
email.

### `POST /api/ai/rewrite`

Rewrites a draft's body in a different tone via Groq (independent of the CopilotKit chat —
used by the Compose page's tone buttons and by the `rewriteComposeBody` assistant action).

**Body**: `{ body: string; tone: "formal" | "shorter" | "longer" | "friendly" }`
**Response**: `{ body: string }` (rewritten text only, no preamble/markdown)

### `POST /api/copilotkit`

CopilotKit's runtime endpoint (`CopilotRuntime` + `GroqAdapter`, model from `GROQ_MODEL`,
`disableParallelToolCalls: true` so compound instructions like "open compose, fill it, send
it" execute in order rather than racing). Session-gated like everything else, but otherwise
opaque to callers — the CopilotKit client (`CopilotProvider.tsx`) is the only intended caller.

### `/api/auth/[...nextauth]`

Auth.js's own catch-all (sign-in, callback, sign-out, session, CSRF). Not hand-written; see
`lib/auth.ts` for provider/adapter config.

## CopilotKit actions

Registered in `components/assistant/AssistantActions.tsx`, mounted once per session inside
the `(mail)` layout. All handlers run client-side and either call the REST routes above or
write directly to the shared Zustand stores that the plain UI also reads from — see
[ARCHITECTURE.md](./ARCHITECTURE.md#ai-action-layer).

| Action | Parameters | What it does |
|---|---|---|
| `openCompose` | `to?, subject?, body?` | Navigates to `/compose`, then fills To → Subject → Body with a short stagger so the fill is visibly incremental |
| `fillComposeField` | `field: "to"\|"subject"\|"body", value` | Patches one field of the open compose draft |
| `resolveContact` | `name` | Looks up past correspondence; auto-responds if 0 or 1 match, otherwise renders `ContactPickerCard` and waits for a click (`renderAndWaitForResponse`) |
| `rewriteComposeBody` | `tone: formal\|shorter\|longer\|friendly` | Calls `/api/ai/rewrite` with the current draft body and replaces it |
| `sendComposedEmail` | *(none — reads the draft store)* | Renders `ConfirmSendCard` and waits for explicit user confirmation before calling `/api/gmail/send` (`renderAndWaitForResponse`) |
| `searchEmails` | `view?, relativeDays?, dateFrom?, dateTo?, sender?, keyword?, readStatus?` | Writes `useFilterStore`, navigates to the target list if not already there, fetches a preview, and renders `EmailPreviewCard` inline in chat. Defaults to `inbox` — the system prompt explicitly forbids inferring `sent` just because that's the page currently open |
| `navigateToEmail` | `view?, sender?, subjectContains?, position?: latest\|oldest` | Finds the best match and routes to `/email/[id]?from=<view>` |
| `replyToCurrentEmail` | `body` | Grounded in whatever email is open (parsed from the current pathname); opens Compose pre-filled with a reply |

Two readables (`useCopilotReadable`) keep the model grounded in what's actually on screen:
current pathname (`AssistantActions.tsx`) and the visible mail list — view, active filters,
and up to 12 truncated email summaries (`EmailList.tsx`, deliberately capped/truncated to stay
under Groq's free-tier ~8000 token/request budget).

A single `useCopilotAdditionalInstructions` block in `AssistantActions.tsx` carries the
behavioral rules that can't be expressed as parameter schemas — e.g. resolve names via
`resolveContact` before composing, write complete professional prose rather than echoing the
user's instruction, default every search/navigate to inbox unless the user explicitly says
"sent".
