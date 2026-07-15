import { NextRequest, NextResponse } from "next/server";
import { requireSession, withReauthHandling } from "@/lib/api-guard";
import { getGmailClient } from "@/lib/gmail/client";

export interface Contact {
  name: string;
  email: string;
}

function parseAddressList(headerValue: string): Contact[] {
  if (!headerValue) return [];
  // Split on commas that aren't inside a quoted display name.
  const parts = headerValue.match(/(?:[^,"]|"[^"]*")+/g) ?? [];
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)<(.+)>$/);
      if (match) {
        return { name: match[1].trim().replace(/^"|"$/g, "") || match[2].trim(), email: match[2].trim() };
      }
      return { name: part, email: part };
    });
}

// Resolves a name to Gmail contacts by searching past correspondence (Gmail
// has no first-class contacts API scope here) — anyone who has emailed the
// user or been emailed by them, matched against From/To headers.
export const GET = withReauthHandling(async (request: NextRequest) => {
  const { session, error } = await requireSession();
  if (error) return error;

  const name = request.nextUrl.searchParams.get("q")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }

  const gmail = await getGmailClient(session.user.id);
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: `{from:"${name}" to:"${name}"}`,
    maxResults: 20,
  });

  const ids = listRes.data.messages ?? [];
  const seen = new Map<string, Contact>();

  await Promise.all(
    ids.map(async ({ id }) => {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: id!,
        format: "metadata",
        metadataHeaders: ["From", "To"],
      });
      const headers = msgRes.data.payload?.headers ?? [];
      const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
      const to = headers.find((h) => h.name?.toLowerCase() === "to")?.value ?? "";
      for (const contact of [...parseAddressList(from), ...parseAddressList(to)]) {
        const needle = name.toLowerCase();
        const matches =
          contact.name.toLowerCase().includes(needle) || contact.email.toLowerCase().includes(needle);
        if (matches && !seen.has(contact.email.toLowerCase())) {
          seen.set(contact.email.toLowerCase(), contact);
        }
      }
    })
  );

  return NextResponse.json({ contacts: Array.from(seen.values()).slice(0, 6) });
});
