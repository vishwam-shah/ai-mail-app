"use client";

import useSWR from "swr";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCopilotReadable } from "@copilotkit/react-core";
import { format } from "date-fns";
import { fetcher } from "@/lib/fetcher";
import { gradientFor } from "@/lib/avatar-gradient";
import { cn } from "@/lib/utils";
import type { EmailDetailData } from "@/lib/gmail/mapper";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiReplyLine, RiErrorWarningLine, RiArrowLeftLine } from "@remixicon/react";

// Renders sender-controlled HTML in a sandboxed, script-disabled iframe so
// email markup can never execute JS against the app (only allow-same-origin,
// which lets us measure content height, is granted).
function EmailHtmlBody({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  return (
    <iframe
      ref={ref}
      srcDoc={html}
      sandbox="allow-same-origin"
      className="w-full border-0"
      style={{ height }}
      onLoad={() => {
        const doc = ref.current?.contentDocument;
        if (doc) setHeight(doc.documentElement.scrollHeight + 16);
      }}
    />
  );
}

export function EmailDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Always return to the list the email was opened from (Inbox by default)
  // instead of browser history, which can land somewhere unexpected when the
  // email was opened via the assistant or several navigations deep.
  const backHref = searchParams.get("from") === "sent" ? "/sent" : "/inbox";
  const { data, isLoading, error } = useSWR<EmailDetailData>(
    `/api/gmail/messages/${id}`,
    fetcher
  );

  // Never forward the full bodyHtml here — raw email HTML can be tens of
  // thousands of characters and would blow past Groq's free-tier per-request
  // token budget on its own. A truncated plain-text preview is plenty for
  // context-aware replies.
  useCopilotReadable({
    description:
      "The single email currently open in the detail view (the one the user is reading right now). Use this for context-aware requests like 'reply to this'.",
    value: data
      ? {
          id: data.id,
          threadId: data.threadId,
          from: data.from,
          fromName: data.fromName,
          to: data.to,
          subject: data.subject,
          date: data.date,
          bodyPreview: (data.bodyText ?? "").slice(0, 500),
        }
      : null,
    available: data ? "enabled" : "disabled",
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <RiErrorWarningLine className="size-8 text-destructive" />
        <p className="text-sm text-destructive">Failed to load email</p>
        {error && <p className="text-xs text-muted-foreground">{(error as Error).message}</p>}
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => router.push(backHref)}>
          <RiArrowLeftLine className="size-4" />
          Back
        </Button>
      </div>
    );
  }

  const seed = data.fromName || data.from;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-white/40 bg-white/15 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.02]">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 text-muted-foreground"
          onClick={() => router.push(backHref)}
        >
          <RiArrowLeftLine className="size-4" />
          Back
        </Button>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">{data.subject}</h1>
          <Button
            render={<Link href={`/compose?replyTo=${data.id}`} />}
            nativeButton={false}
            size="sm"
            className="shrink-0 rounded-full shadow-sm"
          >
            <RiReplyLine className="size-3.5" />
            Reply
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="size-10 shadow-sm ring-1 ring-white/50 dark:ring-white/10">
            <AvatarFallback className={cn("bg-gradient-to-br text-white font-medium", gradientFor(seed))}>
              {seed[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {data.fromName ? `${data.fromName} <${data.from}>` : data.from}
            </p>
            <p className="truncate text-muted-foreground">
              to {data.to.join(", ")}
              {data.cc.length > 0 && `, cc ${data.cc.join(", ")}`}
            </p>
          </div>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {format(new Date(data.date), "PPp")}
          </span>
        </div>
      </div>
      <div className="p-6">
        {data.bodyHtml ? (
          <EmailHtmlBody html={data.bodyHtml} />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.bodyText}</p>
        )}
      </div>
    </div>
  );
}
