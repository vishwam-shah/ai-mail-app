"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { fetcher } from "@/lib/fetcher";

// Keeps already-fetched emails/lists in memory so re-opening the same email
// or going back to a list you've already loaded is instant instead of
// re-fetching from Gmail every time. Revalidates in the background on
// reconnect, but not on every window focus/remount.
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        revalidateIfStale: false,
        dedupingInterval: 60_000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
