"use client";

import { Button } from "@/components/ui/button";
import { RiSendPlaneLine, RiCloseLine } from "@remixicon/react";
import { AssistantCard } from "./AssistantCard";

export interface ConfirmSendCardProps {
  to: string;
  subject: string;
  body: string;
  status: "pending" | "sending" | "sent" | "cancelled" | "error";
  errorMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSendCard({
  to,
  subject,
  body,
  status,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmSendCardProps) {
  const done = status === "sent" || status === "cancelled" || status === "error";

  return (
    <AssistantCard
      padded
      eyebrow={status === "sent" ? "Sent" : status === "cancelled" ? "Cancelled" : "Confirm send"}
    >
      <div className="space-y-1 rounded-lg bg-white/40 p-2.5 dark:bg-white/5">
        <p className="truncate">
          <span className="text-muted-foreground">To </span>
          {to || <span className="text-destructive">missing</span>}
        </p>
        <p className="truncate">
          <span className="text-muted-foreground">Subject </span>
          {subject || <span className="text-destructive">missing</span>}
        </p>
        <p className="line-clamp-3 text-muted-foreground">{body || "(empty body)"}</p>
      </div>

      {status === "error" && (
        <p className="mt-2 text-xs text-destructive">{errorMessage ?? "Failed to send."}</p>
      )}

      {!done && (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onCancel} disabled={status === "sending"}>
            <RiCloseLine className="size-3.5" />
            Cancel
          </Button>
          <Button size="sm" className="rounded-full" onClick={onConfirm} disabled={status === "sending"}>
            <RiSendPlaneLine className="size-3.5" />
            {status === "sending" ? "Sending..." : "Send"}
          </Button>
        </div>
      )}
    </AssistantCard>
  );
}
