"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import {
  useCopilotAction,
  useCopilotReadable,
  useCopilotAdditionalInstructions,
} from "@copilotkit/react-core";
import { useFilterStore, relativeDaysToDateFrom } from "@/lib/filter-state";
import { useComposeStore } from "@/lib/compose-store";
import { fetcher } from "@/lib/fetcher";
import { ConfirmSendCard } from "./ConfirmSendCard";
import { EmailPreviewCard, type EmailPreviewItem } from "./EmailPreviewCard";
import { ContactPickerCard } from "./ContactPickerCard";
import type { EmailSummary } from "@/lib/gmail/mapper";
import type { Contact } from "@/app/api/gmail/contacts/route";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMessages(params: Record<string, string | undefined>): Promise<EmailSummary[]> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const res = await fetch(`/api/gmail/messages?${search.toString()}`);
  if (!res.ok) throw new Error("Failed to search emails");
  const data = await res.json();
  return data.messages as EmailSummary[];
}

function toPreviewItems(messages: EmailSummary[]): EmailPreviewItem[] {
  return messages.map((m) => ({
    id: m.id,
    from: m.fromName || m.from,
    subject: m.subject,
    snippet: m.snippet,
    date: m.date,
    isUnread: m.isUnread,
  }));
}

type SendState = "pending" | "sending" | "sent" | "cancelled" | "error";

function SendConfirmRenderer({ respond }: { respond?: (result: string) => void }) {
  const draft = useComposeStore((s) => s.draft);
  const resetDraft = useComposeStore((s) => s.resetDraft);
  const [state, setState] = useState<SendState>("pending");
  const [errorMessage, setErrorMessage] = useState<string>();
  const respondedRef = useRef(false);

  function safeRespond(result: string) {
    if (respondedRef.current) return;
    respondedRef.current = true;
    respond?.(result);
  }

  // If this card gets unmounted (navigation, chat closed, etc.) before the
  // user ever clicks Confirm/Cancel, the underlying tool call is left with
  // no result forever, which permanently breaks that chat thread on the next
  // message (AI_MissingToolResultsError). Always resolve it on teardown.
  useEffect(() => {
    return () => safeRespond("The confirmation UI was closed before the user responded — treat as cancelled.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm() {
    if (!draft.to || !draft.subject || !draft.body) {
      setState("error");
      setErrorMessage("To, subject, and body are all required before sending.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: draft.to, subject: draft.subject, body: draft.body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send email");
      }
      setState("sent");
      toast.success("Email sent");
      resetDraft();
      safeRespond("The email was sent successfully.");
    } catch (err) {
      setState("error");
      const message = (err as Error).message;
      setErrorMessage(message);
      safeRespond(`Failed to send the email: ${message}`);
    }
  }

  function handleCancel() {
    setState("cancelled");
    safeRespond("The user cancelled sending this email.");
  }

  return (
    <ConfirmSendCard
      to={draft.to}
      subject={draft.subject}
      body={draft.body}
      status={state}
      errorMessage={errorMessage}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}

type ContactResolution =
  | { resolved: true; email: string; name: string }
  | { resolved: false; message: string };

// Looks up a name against past correspondence. Auto-resolves (no user
// interaction) when there's exactly one match or zero matches; only shows
// the picker card — and pauses for a real click — when there's ambiguity.
function ContactResolver({ name, respond }: { name: string; respond?: (result: ContactResolution) => void }) {
  const { data, error } = useSWR<{ contacts: Contact[] }>(
    `/api/gmail/contacts?q=${encodeURIComponent(name)}`,
    fetcher
  );
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current) return;
    if (error) {
      settled.current = true;
      respond?.({ resolved: false, message: `Contact lookup failed. Ask the user for ${name}'s email address directly.` });
      return;
    }
    if (!data) return;
    if (data.contacts.length === 0) {
      settled.current = true;
      respond?.({
        resolved: false,
        message: `No past correspondence found matching "${name}". Ask the user for the email address.`,
      });
    } else if (data.contacts.length === 1) {
      settled.current = true;
      respond?.({ resolved: true, email: data.contacts[0].email, name: data.contacts[0].name });
    }
    // Multiple matches: fall through to the picker below and wait for a click.
  }, [data, error, name, respond]);

  // Same safety net as SendConfirmRenderer: never leave this tool call
  // unresolved if the card is torn down before the user picks a contact.
  useEffect(() => {
    return () => {
      if (!settled.current) {
        settled.current = true;
        respond?.({ resolved: false, message: "Contact picker was closed before a selection was made." });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Looking up &ldquo;{name}&rdquo;...</p>;
  }
  if (data.contacts.length <= 1) return null;

  return (
    <ContactPickerCard
      name={name}
      contacts={data.contacts}
      onSelect={(contact) => {
        if (settled.current) return;
        settled.current = true;
        respond?.({ resolved: true, email: contact.email, name: contact.name });
      }}
    />
  );
}

// Registers every action the assistant can use to drive the UI. Mounted once
// inside the (mail) layout so it stays active across all page navigations.
export function AssistantActions() {
  const router = useRouter();
  const pathname = usePathname();
  const setFilters = useFilterStore((s) => s.setFilters);
  const setDraft = useComposeStore((s) => s.setDraft);
  const resetDraft = useComposeStore((s) => s.resetDraft);

  useCopilotReadable({
    description: "Which page of the mail app the user is currently viewing.",
    value: { path: pathname },
  });

  useCopilotAdditionalInstructions({
    instructions: `You are an assistant embedded in a Gmail-connected mail client. You drive the UI directly instead of only replying with text.
- If the user gives a recipient's NAME instead of a full email address (e.g. "email John about..."), call resolveContact with that name FIRST, before openCompose. It looks up past correspondence and either resolves automatically or shows the user a picker if several people match — never guess an email address yourself.
- The user often gives you only a rough idea, not exact wording (e.g. "tell Sarah the meeting moved to 3pm"). Write the actual subject and a complete, well-structured, professional email body yourself from that context — proper greeting, clear body, polite sign-off. Do not just restate the user's instruction as the body; compose real prose.
- To compose a new email, call openCompose with the recipient email plus the subject/body you drafted. This opens the compose view and visibly fills the fields.
- If the user asks to change the tone of the current draft (e.g. "make it shorter", "more formal", "friendlier"), call rewriteComposeBody with the closest matching tone.
- To actually send, call sendComposedEmail. It shows a confirmation card the user (or you) must confirm — never claim an email was sent before that confirmation completes.
- To find or filter emails, call searchEmails. This updates the Inbox/Sent list on screen, not just the chat. ALWAYS default to the inbox for these — only search "sent" if the user explicitly says something like "that I sent" or "in my sent mail". The page currently open is not a signal for this; ignore it when deciding inbox vs sent.
- To jump to a specific email, call navigateToEmail. Same inbox-by-default rule applies here.
- If the user says something like "reply to this" while an email is open, use replyToCurrentEmail, grounded in the currently open email from context, and write a complete, well-written, professional reply — not a one-line stub.
- Keep chat replies brief — the UI updates are the primary feedback.`,
  });

  useCopilotAction(
    {
      name: "openCompose",
      description:
        "Open the compose view and fill in the To/Subject/Body fields. Call this before sendComposedEmail. `to` must be a real email address (use resolveContact first if you only have a name) — write a complete, professional subject and body yourself based on whatever context the user gave, don't just echo their instruction back.",
      parameters: [
        { name: "to", type: "string", description: "Recipient email address", required: false },
        { name: "subject", type: "string", description: "Full email subject you composed", required: false },
        { name: "body", type: "string", description: "Full, well-written email body you composed", required: false },
      ],
      handler: async ({ to, subject, body }) => {
        resetDraft();
        if (pathname !== "/compose") router.push("/compose");
        await sleep(350);
        if (to) {
          setDraft({ to });
          await sleep(200);
        }
        if (subject) {
          setDraft({ subject });
          await sleep(200);
        }
        if (body) {
          setDraft({ body });
        }
        return "Compose view opened and fields filled in.";
      },
    },
    [pathname]
  );

  useCopilotAction(
    {
      name: "fillComposeField",
      description: "Update a single field in the currently open compose form.",
      parameters: [
        {
          name: "field",
          type: "string",
          description: "Which field to update",
          required: true,
          enum: ["to", "subject", "body"],
        },
        { name: "value", type: "string", description: "The new value", required: true },
      ],
      handler: async ({ field, value }) => {
        setDraft({ [field]: value });
        return `Updated ${field}.`;
      },
    },
    []
  );

  useCopilotAction(
    {
      name: "resolveContact",
      description:
        "Look up a person's real email address from past correspondence when the user gave only a name. Auto-resolves silently if there's exactly one match; shows the user a picker card if there are several. Returns { resolved: false, message } if nobody matched — in that case ask the user for the email directly instead of guessing.",
      parameters: [{ name: "name", type: "string", description: "The person's name to search for", required: true }],
      renderAndWaitForResponse: ({ status, args, respond }) => {
        if (status === "inProgress") {
          return <p className="text-sm text-muted-foreground">Looking up contact...</p>;
        }
        if (status === "complete") return <></>;
        return <ContactResolver name={args.name} respond={respond} />;
      },
    },
    []
  );

  useCopilotAction(
    {
      name: "rewriteComposeBody",
      description:
        "Rewrite the body of the currently open compose form in a different tone (formal, shorter, longer, or friendly). Updates the visible draft directly.",
      parameters: [
        {
          name: "tone",
          type: "string",
          description: "The tone/style to rewrite towards",
          required: true,
          enum: ["formal", "shorter", "longer", "friendly"],
        },
      ],
      handler: async ({ tone }) => {
        const current = useComposeStore.getState().draft.body;
        if (!current.trim()) {
          return "The compose body is empty — nothing to rewrite.";
        }
        const res = await fetch("/api/ai/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: current, tone }),
        });
        if (!res.ok) {
          return "Failed to rewrite the email body.";
        }
        const { body } = await res.json();
        setDraft({ body });
        return `Rewrote the email body in a ${tone} tone.`;
      },
    },
    []
  );

  useCopilotAction(
    {
      name: "sendComposedEmail",
      description:
        "Send the email currently shown in the compose form. Always requires user confirmation via the card this renders — call openCompose first if fields aren't filled yet.",
      parameters: [],
      renderAndWaitForResponse: ({ status, respond }) => {
        if (status === "inProgress") {
          return <p className="text-sm text-muted-foreground">Preparing to send...</p>;
        }
        if (status === "complete") {
          return <p className="text-sm text-muted-foreground">Done.</p>;
        }
        return <SendConfirmRenderer respond={respond} />;
      },
    },
    []
  );

  useCopilotAction(
    {
      name: "searchEmails",
      description:
        "Search or filter the Inbox/Sent list. This updates the actual list on screen. Use relativeDays for phrases like 'last 10 days'. IMPORTANT: default view to 'inbox' unless the user's own wording clearly refers to sent mail (e.g. 'that I sent', 'emails I sent', 'in my sent folder'). Never infer 'sent' just because that happens to be the page currently open — 'show me emails from the last 10 days' with no other qualifier always means the inbox.",
      parameters: [
        {
          name: "view",
          type: "string",
          description:
            "Which list to search. Only pass 'sent' if the user explicitly referred to mail THEY sent; otherwise omit this or pass 'inbox'.",
          required: false,
          enum: ["inbox", "sent"],
        },
        { name: "relativeDays", type: "number", description: "Only show emails from the last N days", required: false },
        { name: "dateFrom", type: "string", description: "ISO date (yyyy-mm-dd) lower bound", required: false },
        { name: "dateTo", type: "string", description: "ISO date (yyyy-mm-dd) upper bound", required: false },
        { name: "sender", type: "string", description: "Filter by sender name or email", required: false },
        { name: "keyword", type: "string", description: "Keyword to search for in subject or body", required: false },
        {
          name: "readStatus",
          type: "string",
          description: "Filter by read state",
          required: false,
          enum: ["all", "unread", "read"],
        },
      ],
      handler: async ({ view, relativeDays, dateFrom, dateTo, sender, keyword, readStatus }) => {
        const nextFilters = {
          dateFrom: relativeDays ? relativeDaysToDateFrom(relativeDays) : (dateFrom ?? null),
          dateTo: dateTo ?? null,
          sender: sender ?? null,
          keyword: keyword ?? null,
          readStatus: readStatus ?? ("all" as const),
        };
        setFilters(nextFilters);
        const target = view === "sent" ? "/sent" : "/inbox";
        if (pathname !== target) router.push(target);

        const messages = await fetchMessages({
          view: view ?? "inbox",
          dateFrom: nextFilters.dateFrom ?? undefined,
          dateTo: nextFilters.dateTo ?? undefined,
          sender: nextFilters.sender ?? undefined,
          keyword: nextFilters.keyword ?? undefined,
          readStatus: nextFilters.readStatus !== "all" ? nextFilters.readStatus : undefined,
        });
        return { count: messages.length, preview: toPreviewItems(messages) };
      },
      render: ({ status, args, result }) => {
        if (status !== "complete") {
          return <p className="text-sm text-muted-foreground">Searching your mail...</p>;
        }
        return (
          <EmailPreviewCard
            title={`${result.count} email(s) found`}
            emails={result.preview}
            view={args.view === "sent" ? "sent" : "inbox"}
          />
        );
      },
    },
    [pathname]
  );

  useCopilotAction(
    {
      name: "navigateToEmail",
      description:
        "Find a specific email (by sender, subject, or 'latest'/'oldest') and open it in the detail view. Default to inbox unless the user clearly means sent mail.",
      parameters: [
        {
          name: "view",
          type: "string",
          description:
            "Which list to search. Only pass 'sent' if the user explicitly referred to mail THEY sent; otherwise omit this or pass 'inbox'.",
          required: false,
          enum: ["inbox", "sent"],
        },
        { name: "sender", type: "string", description: "Sender name or email to match", required: false },
        { name: "subjectContains", type: "string", description: "Text the subject should contain", required: false },
        {
          name: "position",
          type: "string",
          description: "Pick the latest or oldest match",
          required: false,
          enum: ["latest", "oldest"],
        },
      ],
      handler: async ({ view, sender, subjectContains, position }) => {
        const resolvedView = view ?? "inbox";
        const messages = await fetchMessages({
          view: resolvedView,
          sender,
          keyword: subjectContains,
        });
        if (messages.length === 0) {
          return { found: false as const };
        }
        const ordered = position === "oldest" ? [...messages].reverse() : messages;
        const target = ordered[0];
        router.push(`/email/${target.id}?from=${resolvedView}`);
        return { found: true as const, subject: target.subject, from: target.fromName || target.from };
      },
    },
    []
  );

  useCopilotAction(
    {
      name: "replyToCurrentEmail",
      description:
        "Reply to the email the user currently has open in the detail view. Draft the reply body yourself, grounded in that email's content and what the user asked for.",
      parameters: [{ name: "body", type: "string", description: "The reply body to pre-fill", required: true }],
      handler: async ({ body }) => {
        const match = pathname.match(/\/email\/(.+)$/);
        if (!match) {
          return "No email is currently open — ask the user to open one first.";
        }
        const emailId = match[1];
        resetDraft();
        router.push(`/compose?replyTo=${emailId}`);
        await sleep(500);
        setDraft({ body });
        return "Reply drafted from the open email.";
      },
    },
    [pathname]
  );

  return null;
}
