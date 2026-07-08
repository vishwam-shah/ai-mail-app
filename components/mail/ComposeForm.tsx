"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { useCopilotReadable } from "@copilotkit/react-core";
import { format } from "date-fns";
import { fetcher } from "@/lib/fetcher";
import { useComposeStore } from "@/lib/compose-store";
import type { EmailDetailData } from "@/lib/gmail/mapper";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RiSendPlaneLine, RiQuillPenLine, RiSparkling2Line } from "@remixicon/react";

const TONE_OPTIONS = [
  { id: "formal", label: "Formal" },
  { id: "shorter", label: "Shorter" },
  { id: "longer", label: "Longer" },
  { id: "friendly", label: "Friendly" },
] as const;

export function ComposeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const replyToId = searchParams.get("replyTo");
  const { draft, setDraft, resetDraft } = useComposeStore();
  const [sending, setSending] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);

  const { data: original } = useSWR<EmailDetailData>(
    replyToId ? `/api/gmail/messages/${replyToId}` : null,
    fetcher
  );

  useEffect(() => {
    if (!original) return;
    const quoted = (original.bodyText ?? "")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    setDraft({
      to: original.from,
      subject: original.subject.toLowerCase().startsWith("re:")
        ? original.subject
        : `Re: ${original.subject}`,
      body: `\n\nOn ${format(new Date(original.date), "PPp")}, ${
        original.fromName || original.from
      } wrote:\n${quoted}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  useCopilotReadable({
    description:
      "The compose form the user currently has open, including whatever has been filled in so far.",
    value: {
      isReply: Boolean(replyToId),
      to: draft.to,
      subject: draft.subject,
      // Reply bodies quote the original email and can get long — truncate
      // so this stays small in every assistant request.
      body: draft.body.slice(0, 500),
    },
  });

  async function handleRewrite(tone: string) {
    if (!draft.body.trim()) {
      toast.error("Write something first.");
      return;
    }
    setRewriting(tone);
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.body, tone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to rewrite");
      }
      const { body } = await res.json();
      setDraft({ body });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRewriting(null);
    }
  }

  async function handleSend() {
    if (!draft.to || !draft.subject || !draft.body) {
      toast.error("To, subject, and body are all required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          threadId: original?.threadId,
          inReplyTo: replyToId ?? undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send email");
      }
      toast.success("Email sent");
      resetDraft();
      router.push("/sent");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto p-6">
      <div className="flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-white/40 bg-card/60 p-6 shadow-lg dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <RiQuillPenLine className="size-4" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">
            {replyToId ? "Reply" : "New Message"}
          </h1>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="compose-to">To</Label>
          <Input
            id="compose-to"
            placeholder="recipient@example.com"
            className="bg-white/50 dark:bg-white/5"
            value={draft.to}
            onChange={(e) => setDraft({ to: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="compose-subject">Subject</Label>
          <Input
            id="compose-subject"
            placeholder="Subject"
            className="bg-white/50 dark:bg-white/5"
            value={draft.subject}
            onChange={(e) => setDraft({ subject: e.target.value })}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="compose-body">Body</Label>
            <div className="flex items-center gap-1">
              <RiSparkling2Line className="size-3.5 text-muted-foreground" />
              {TONE_OPTIONS.map((tone) => (
                <Button
                  key={tone.id}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="rounded-full"
                  disabled={rewriting !== null}
                  onClick={() => handleRewrite(tone.id)}
                >
                  {rewriting === tone.id ? "..." : tone.label}
                </Button>
              ))}
            </div>
          </div>
          <Textarea
            id="compose-body"
            placeholder="Write your message..."
            className="min-h-72 resize-none bg-white/50 dark:bg-white/5"
            value={draft.body}
            onChange={(e) => setDraft({ body: e.target.value })}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSend} disabled={sending} className="rounded-full px-5 shadow-sm">
            <RiSendPlaneLine className="size-4" />
            {sending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
