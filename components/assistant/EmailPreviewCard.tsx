"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { gradientFor } from "@/lib/avatar-gradient";
import { cn } from "@/lib/utils";
import { AssistantCard, AssistantCardList, AssistantCardRow } from "./AssistantCard";

export interface EmailPreviewItem {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread?: boolean;
}

export function EmailPreviewCard({
  title,
  emails,
  view = "inbox",
}: {
  title: string;
  emails: EmailPreviewItem[];
  view?: "inbox" | "sent";
}) {
  const router = useRouter();

  if (emails.length === 0) {
    return (
      <AssistantCard padded>
        <p className="text-sm text-muted-foreground">No matching emails found.</p>
      </AssistantCard>
    );
  }

  return (
    <AssistantCard eyebrow={title} eyebrowBordered>
      <AssistantCardList>
        {emails.slice(0, 5).map((email) => (
          <AssistantCardRow
            key={email.id}
            onClick={() => router.push(`/email/${email.id}?from=${view}`)}
            avatar={
              <Avatar className="mt-0.5 size-7 shrink-0">
                <AvatarFallback className={cn("bg-gradient-to-br text-[10px] text-white", gradientFor(email.from))}>
                  {email.from[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            }
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate", email.isUnread ? "font-semibold" : "font-medium")}>
                {email.from}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{email.subject}</p>
          </AssistantCardRow>
        ))}
      </AssistantCardList>
    </AssistantCard>
  );
}
