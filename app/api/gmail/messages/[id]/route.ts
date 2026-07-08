import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-guard";
import { getGmailClient } from "@/lib/gmail/client";
import { mapMessageToDetail } from "@/lib/gmail/mapper";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id } = await params;
  const gmail = await getGmailClient(session.user.id);

  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  return NextResponse.json(mapMessageToDetail(res.data));
}
