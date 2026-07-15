import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

const baseAdapter = PrismaAdapter(prisma);

// Wrap the adapter so OAuth tokens are encrypted at rest the moment they're persisted.
// Tokens are decrypted on demand in lib/google-auth.ts, never exposed via the session.
const adapter: Adapter = {
  ...baseAdapter,
  async linkAccount(account): Promise<AdapterAccount | null | undefined> {
    const encrypted = {
      ...account,
      access_token: account.access_token ? encryptToken(account.access_token) : account.access_token,
      refresh_token: account.refresh_token ? encryptToken(account.refresh_token) : account.refresh_token,
    };
    return (await baseAdapter.linkAccount!(encrypted)) ?? undefined;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: GMAIL_SCOPES,
        },
      },
    }),
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // The Prisma adapter only persists tokens when an account is FIRST
    // linked; on later sign-ins the fresh tokens Google just issued are
    // dropped and the stored ones go stale (Google expires testing-mode
    // refresh tokens after 7 days). Since we always request prompt=consent,
    // every sign-in returns new tokens — persist them every time so signing
    // in again always repairs an expired/revoked refresh token.
    async signIn({ account }) {
      if (!account?.access_token) return;
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: encryptToken(account.access_token),
          refresh_token: account.refresh_token ? encryptToken(account.refresh_token) : undefined,
          expires_at: account.expires_at,
        },
      });
    },
  },
  pages: {
    signIn: "/login",
  },
});
