import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guard";
import { getGmailClient } from "@/lib/gmail/client";
import { mapMessageToSummary } from "@/lib/gmail/mapper";
import { buildGmailQuery, type MailView } from "@/lib/gmail/queries";
import { defaultFilterState, type FilterState } from "@/lib/filter-state";
import { mapWithConcurrency } from "@/lib/concurrency";

const PAGE_SIZE = 50;
// Gmail allows ~250 quota units/user/sec; a metadata get costs ~5 units, so
// keep concurrent in-flight detail fetches well under that ceiling per page.
const DETAIL_FETCH_CONCURRENCY = 10;

export async function GET(request: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const view = (params.get("view") === "sent" ? "sent" : "inbox") as MailView;
  const pageToken = params.get("pageToken") ?? undefined;

  const filters: FilterState = {
    ...defaultFilterState,
    dateFrom: params.get("dateFrom"),
    dateTo: params.get("dateTo"),
    sender: params.get("sender"),
    keyword: params.get("keyword"),
    readStatus: (params.get("readStatus") as FilterState["readStatus"]) ?? "all",
  };

  const gmail = await getGmailClient(session.user.id);
  const q = buildGmailQuery(view, filters);

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: PAGE_SIZE,
    pageToken,
  });

  const ids = listRes.data.messages ?? [];
  const messages = await mapWithConcurrency(ids, DETAIL_FETCH_CONCURRENCY, async ({ id }) => {
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: id!,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Cc", "Date"],
    });
    return mapMessageToSummary(msgRes.data);
  });

  return NextResponse.json({
    messages,
    nextPageToken: listRes.data.nextPageToken ?? null,
  });
}
