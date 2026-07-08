"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/fetcher";
import type { EmailSummary } from "@/lib/gmail/mapper";

const POLL_INTERVAL_MS = 20_000;

interface SyncStatusResponse {
  count: number;
  newMessages: EmailSummary[];
}

// Polls /api/gmail/sync-status so new inbox mail shows up without a manual
// refresh: any visible message list revalidates, and a toast announces the
// sender/subject with a one-click jump to the email. Mounted once in the
// (mail) layout so it keeps running on every page.
export function NewMailNotifier() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const announcedIds = useRef<Set<string>>(new Set());

  const { data } = useSWR<SyncStatusResponse>("/api/gmail/sync-status", fetcher, {
    refreshInterval: POLL_INTERVAL_MS,
    // The global config dedupes for 60s to keep mail lists cache-friendly;
    // this endpoint IS the freshness signal, so let every poll through.
    dedupingInterval: 0,
    revalidateIfStale: true,
    // A failed poll (expired session, transient network) shouldn't toast or
    // retry aggressively — the next interval tick will try again anyway.
    shouldRetryOnError: false,
  });

  useEffect(() => {
    if (!data || data.count === 0) return;

    const unannounced = data.newMessages.filter((m) => !announcedIds.current.has(m.id));
    if (unannounced.length === 0) return;
    for (const m of unannounced) announcedIds.current.add(m.id);

    // Re-fetch whatever mail lists are on screen (inbox or sent, any filters).
    mutate((key) => typeof key === "string" && key.startsWith("/api/gmail/messages?"));

    for (const message of unannounced) {
      toast.info(`New email from ${message.fromName || message.from}`, {
        description: message.subject,
        action: {
          label: "Open",
          onClick: () => router.push(`/email/${message.id}?from=inbox`),
        },
      });
    }
    const extra = data.count - data.newMessages.length;
    if (extra > 0) {
      toast.info(`${extra} more new email${extra === 1 ? "" : "s"} in your inbox`);
    }
  }, [data, mutate, router]);

  return null;
}
