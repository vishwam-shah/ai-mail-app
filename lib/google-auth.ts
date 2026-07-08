import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";

// Returns a valid (non-expired) Gmail access token for the user, refreshing
// and persisting a new one if the stored token is expired or about to expire.
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) {
    throw new Error("No linked Google account for this user");
  }

  const expiresAtMs = (account.expires_at ?? 0) * 1000;
  const needsRefresh = expiresAtMs < Date.now() + 60_000;

  if (!needsRefresh) {
    return decryptToken(account.access_token);
  }

  if (!account.refresh_token) {
    throw new Error("Google account has no refresh token; user must re-consent");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: decryptToken(account.refresh_token) });

  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google access token");
  }

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: encryptToken(credentials.access_token),
      expires_at: credentials.expiry_date ? Math.floor(credentials.expiry_date / 1000) : null,
    },
  });

  return credentials.access_token;
}
