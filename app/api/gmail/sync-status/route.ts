import { NextResponse } from "next/server";
import type { gmail_v1 } from "googleapis";
import { requireSession } from "@/lib/api-guard";
import { getGmailClient } from "@/lib/gmail/client";
import { mapMessageToSummary, type EmailSummary } from "@/lib/gmail/mapper";
import { prisma } from "@/lib/prisma";

// How many new messages to hydrate with metadata per poll (the toast only
// shows a few anyway; the count still reflects everything that arrived).
const MAX_HYDRATED = 3;
const MAX_HISTORY_PAGES = 5;

async function baselineCursor(gmail: gmail_v1.Gmail, userId: string): Promise<void> {
  const profile = await gmail.users.getProfile({ userId: "me" });
  const historyId = String(profile.data.historyId);
  await prisma.gmailWatch.upsert({
    where: { userId },
    create: { userId, historyId, watchExpiration: new Date(0), topicName: "" },
    update: { historyId },
  });
}

// Cheap incremental-sync poll: diffs Gmail's history log against a per-user
// cursor (GmailWatch.historyId) and reports inbox messages added since the
// last poll. The client hits this on an interval; a Pub/Sub push pipeline
// could later move the cursor server-side without changing this contract.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const userId = session.user.id;
  const gmail = await getGmailClient(userId);

  const watch = await prisma.gmailWatch.findUnique({ where: { userId } });
  if (!watch) {
    // First poll for this user: record where "now" is and report no changes.
    await baselineCursor(gmail, userId);
    return NextResponse.json({ count: 0, newMessages: [] });
  }

  let history: gmail_v1.Schema$History[] = [];
  let latestHistoryId = watch.historyId;
  try {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId: watch.historyId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
        pageToken,
      });
      history = history.concat(res.data.history ?? []);
      if (res.data.historyId) latestHistoryId = String(res.data.historyId);
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }
  } catch (err) {
    const status = (err as { status?: number; code?: number }).status ?? (err as { code?: number }).code;
    if (status === 404) {
      // Cursor older than Gmail's ~7-day history window — re-baseline and
      // resume diffing from now rather than failing every poll forever.
      await baselineCursor(gmail, userId);
      return NextResponse.json({ count: 0, newMessages: [] });
    }
    throw err;
  }

  const newIds: string[] = [];
  const seen = new Set<string>();
  for (const entry of history) {
    for (const added of entry.messagesAdded ?? []) {
      const msg = added.message;
      if (msg?.id && !seen.has(msg.id) && (msg.labelIds ?? []).includes("INBOX")) {
        seen.add(msg.id);
        newIds.push(msg.id);
      }
    }
  }

  if (latestHistoryId !== watch.historyId) {
    await prisma.gmailWatch.update({ where: { userId }, data: { historyId: latestHistoryId } });
  }

  let newMessages: EmailSummary[] = [];
  if (newIds.length > 0) {
    newMessages = await Promise.all(
      newIds.slice(0, MAX_HYDRATED).map(async (id) => {
        const msgRes = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "To", "Date"],
        });
        return mapMessageToSummary(msgRes.data);
      })
    );
  }

  return NextResponse.json({ count: newIds.length, newMessages });
}
