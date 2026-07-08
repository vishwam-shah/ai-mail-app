"use client";

import Link from "next/link";
import { preload } from "swr";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFor } from "@/lib/avatar-gradient";
import { fetcher } from "@/lib/fetcher";
import type { EmailSummary } from "@/lib/gmail/mapper";
import type { MailView } from "@/lib/gmail/queries";

function prefetchEmail(id: string) {
  preload(`/api/gmail/messages/${id}`, fetcher);
}

export function EmailListItem({ email, view }: { email: EmailSummary; view: MailView }) {
  const primaryLabel =
    view === "sent" ? email.to.join(", ") || "(no recipients)" : email.fromName || email.from;
  const seed = view === "sent" ? email.to[0] ?? email.subject : email.fromName || email.from;
  const initial = seed?.[0]?.toUpperCase() ?? "?";

  return (
    <Link
      href={`/email/${email.id}?from=${view}`}
      onMouseEnter={() => prefetchEmail(email.id)}
      onFocus={() => prefetchEmail(email.id)}
      className={cn(
        "group relative flex items-start gap-3 px-4 py-3 text-sm transition-all duration-150",
        "hover:z-10 hover:-translate-y-px hover:bg-white/40 hover:shadow-[0_4px_16px_-4px_oklch(0_0_0/0.12)] dark:hover:bg-white/5 dark:hover:shadow-[0_4px_16px_-4px_oklch(0_0_0/0.4)]",
        email.isUnread && "bg-white/25 dark:bg-white/[0.03]"
      )}
    >
      {email.isUnread && (
        <span className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <Avatar className="mt-0.5 size-9 shrink-0 shadow-sm ring-1 ring-white/50 dark:ring-white/10">
        <AvatarFallback className={cn("bg-gradient-to-br text-white font-medium", gradientFor(seed))}>
          {initial}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate", email.isUnread ? "font-semibold" : "font-medium")}>
            {primaryLabel}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
          </span>
        </div>
        <p className={cn("truncate", email.isUnread ? "font-medium" : "text-muted-foreground")}>
          {email.subject}
        </p>
        <p className="truncate text-xs text-muted-foreground/80">{email.snippet}</p>
      </div>
    </Link>
  );
}
