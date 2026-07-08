import { google, gmail_v1 } from "googleapis";
import { getGoogleAccessToken } from "@/lib/google-auth";

export async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  const accessToken = await getGoogleAccessToken(userId);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}
