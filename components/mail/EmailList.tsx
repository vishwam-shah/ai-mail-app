"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { useCopilotReadable } from "@copilotkit/react-core";
import { useFilterStore } from "@/lib/filter-state";
import { fetcher } from "@/lib/fetcher";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { EmailListItem } from "./EmailListItem";
import { FilterBar } from "./FilterBar";
import { Pagination } from "./Pagination";
import type { EmailSummary } from "@/lib/gmail/mapper";
import type { MailView } from "@/lib/gmail/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { RiInboxLine, RiErrorWarningLine } from "@remixicon/react";

interface MessagesResponse {
  messages: EmailSummary[];
  nextPageToken: string | null;
}

function buildQueryString(view: MailView, filters: ReturnType<typeof useFilterStore.getState>["filters"]) {
  const params = new URLSearchParams({ view });
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.sender) params.set("sender", filters.sender);
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.readStatus !== "all") params.set("readStatus", filters.readStatus);
  return params.toString();
}

export function EmailList({ view }: { view: MailView }) {
  const filters = useFilterStore((s) => s.filters);
  const queryString = buildQueryString(view, filters);
  const pagination = useCursorPagination(queryString);

  const requestQuery = pagination.token
    ? `${queryString}&pageToken=${pagination.token}`
    : queryString;

  const { data, isLoading, error } = useSWR<MessagesResponse>(
    `/api/gmail/messages?${requestQuery}`,
    fetcher
  );

  useEffect(() => {
    if (data) pagination.reportNextToken(data.nextPageToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Keep this small: it's re-sent as context on every assistant message, and
  // Groq's free tier has an ~8000 token/request budget. Cap the count and
  // truncate free-text fields rather than sending the full page of results.
  useCopilotReadable({
    description:
      "The mail list currently visible to the user (either the Inbox or Sent view), the active filters, and the first emails shown (may be truncated). Use this to resolve references like 'the email from X about Y' against what's on screen, and to know what filters are already applied.",
    value: {
      view,
      activeFilters: filters,
      page: pagination.index + 1,
      totalVisible: data?.messages.length ?? 0,
      visibleEmails: (data?.messages ?? []).slice(0, 12).map((m) => ({
        id: m.id,
        from: m.fromName || m.from,
        subject: m.subject.slice(0, 60),
        snippet: m.snippet.slice(0, 60),
        date: m.date.slice(0, 10),
        isUnread: m.isUnread,
      })),
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <FilterBar>
        <Pagination
          variant="compact"
          page={pagination.index}
          knownCount={pagination.knownCount}
          hasNext={pagination.hasNext}
          hasPrev={pagination.hasPrev}
          onPageChange={pagination.goToPage}
          onNext={pagination.next}
          onPrev={pagination.prev}
          loading={isLoading}
        />
      </FilterBar>
      {error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <RiErrorWarningLine className="size-8 text-destructive" />
          <p className="text-sm text-destructive">Failed to load emails</p>
          <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
        </div>
      )}
      {isLoading && (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!isLoading && !error && data?.messages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-white/40 dark:bg-white/5">
            <RiInboxLine className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No emails found</p>
          <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
        </div>
      )}
      {!isLoading && !error && data && data.messages.length > 0 && (
        <>
          <div className="flex min-h-0 flex-1 flex-col divide-y divide-white/40 overflow-y-auto dark:divide-white/10">
            {data.messages.map((email) => (
              <EmailListItem key={email.id} email={email} view={view} />
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-center border-t border-white/40 p-2.5 dark:border-white/10">
            <Pagination
              variant="full"
              page={pagination.index}
              knownCount={pagination.knownCount}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
              onPageChange={pagination.goToPage}
              onNext={pagination.next}
              onPrev={pagination.prev}
              loading={isLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
