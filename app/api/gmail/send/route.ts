import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-guard";
import { getGmailClient } from "@/lib/gmail/client";
import { buildRawMessage } from "@/lib/gmail/mime";

const sendSchema = z.object({
  to: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const { session, error: authError } = await requireSession();
  if (authError) return authError;

  const json = await request.json();
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { to, subject, body, threadId, inReplyTo, references } = parsed.data;
  const gmail = await getGmailClient(session.user.id);
  const raw = await buildRawMessage({
    from: session.user.email,
    to,
    subject,
    body,
    inReplyTo,
    references,
  });

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId },
  });

  return NextResponse.json({ id: res.data.id, threadId: res.data.threadId });
}
