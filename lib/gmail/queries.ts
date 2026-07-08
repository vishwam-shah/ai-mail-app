import type { FilterState } from "@/lib/filter-state";

export type MailView = "inbox" | "sent";

function toGmailDate(isoDate: string): string {
  // Gmail's after:/before: operators want YYYY/MM/DD
  return isoDate.replaceAll("-", "/");
}

// Strips characters Gmail search syntax treats specially so filter values
// can't break out of their operator (e.g. a keyword containing `"` or `:`).
function sanitizeTerm(value: string): string {
  return value.replace(/["\n\r]/g, "").trim();
}

export function buildGmailQuery(view: MailView, filters: FilterState): string {
  const parts: string[] = [view === "inbox" ? "in:inbox" : "in:sent"];

  if (filters.dateFrom) parts.push(`after:${toGmailDate(filters.dateFrom)}`);
  if (filters.dateTo) parts.push(`before:${toGmailDate(filters.dateTo)}`);
  if (filters.sender) parts.push(`from:${sanitizeTerm(filters.sender)}`);
  if (filters.keyword) parts.push(`"${sanitizeTerm(filters.keyword)}"`);
  if (filters.readStatus === "unread") parts.push("is:unread");
  if (filters.readStatus === "read") parts.push("is:read");

  return parts.join(" ");
}
