import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getGmailClient } from "../lib/gmail/client";
import { mapMessageToSummary } from "../lib/gmail/mapper";

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (!user) throw new Error("No signed-in user found in the database yet");

  const gmail = await getGmailClient(user.id);
  const list = await gmail.users.messages.list({ userId: "me", q: "in:inbox", maxResults: 5 });

  const ids = list.data.messages ?? [];
  console.log(`Fetched ${ids.length} message ids from inbox`);

  for (const { id } of ids) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id: id!,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });
    const summary = mapMessageToSummary(msg.data);
    console.log(`- [${summary.isUnread ? "UNREAD" : "read"}] ${summary.fromName ?? summary.from}: ${summary.subject}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
