"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared shell for the glass cards the assistant renders inline in chat
 * (contact picker, email results, send confirmation). Two eyebrow styles:
 * a bordered header for list-style cards, or a plain label for padded ones.
 */
export function AssistantCard({
  eyebrow,
  eyebrowBordered = false,
  padded = false,
  children,
}: {
  eyebrow?: string;
  eyebrowBordered?: boolean;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "my-1 w-full max-w-sm overflow-hidden rounded-xl border border-white/40 bg-card/70 shadow-md dark:border-white/10",
        padded && "p-3.5"
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            "text-xs font-medium tracking-wide text-muted-foreground uppercase",
            eyebrowBordered
              ? "border-b border-white/40 px-3.5 py-2 dark:border-white/10"
              : "mb-2"
          )}
        >
          {eyebrow}
        </p>
      )}
      {children}
    </div>
  );
}

export function AssistantCardList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-white/40 dark:divide-white/10">{children}</div>;
}

export function AssistantCardRow({
  onClick,
  avatar,
  children,
}: {
  onClick: () => void;
  avatar: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2.5 p-3 text-left text-sm transition-colors hover:bg-white/40 dark:hover:bg-white/5"
    >
      {avatar}
      <div className="min-w-0 flex-1">{children}</div>
    </button>
  );
}
