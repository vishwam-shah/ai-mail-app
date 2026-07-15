import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/crypto";

// Thrown when Google refuses the refresh token (invalid_grant: expired or
// revoked — e.g. testing-mode consents die after 7 days). Not a server bug:
// the only fix is the user signing in again, so API routes translate this
// into a 401 with code REAUTH_REQUIRED instead of a 500.
export class ReauthRequiredError extends Error {
  constructor() {
    super("Google session expired or revoked — please sign in again.");
    this.name = "ReauthRequiredError";
  }
}

function isInvalidGrant(err: unknown): boolean {
  const data = (err as { response?: { data?: { error?: string } } }).response?.data;
  return data?.error === "invalid_grant" || (err as Error).message?.includes("invalid_grant");
}

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
    throw new ReauthRequiredError();
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: decryptToken(account.refresh_token) });

  let credentials;
  try {
    ({ credentials } = await oauth2Client.refreshAccessToken());
  } catch (err) {
    if (isInvalidGrant(err)) throw new ReauthRequiredError();
    throw err;
  }
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
