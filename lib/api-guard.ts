import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ReauthRequiredError } from "@/lib/google-auth";

export interface AuthedSession {
  user: { id: string; email: string; name?: string | null; image?: string | null };
}

type RequireSessionResult = { session: AuthedSession; error?: undefined } | { session?: undefined; error: NextResponse };

/**
 * Every Gmail/AI route needs the same "is there a signed-in user" check
 * before touching anything. Centralizes it instead of repeating
 * `auth()` + a manual 401 in every route handler.
 *
 * ```ts
 * const { session, error } = await requireSession();
 * if (error) return error;
 * // session.user.id / session.user.email are safe to use below
 * ```
 */
export async function requireSession(): Promise<RequireSessionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session: session as AuthedSession };
}

/**
 * Wraps a Gmail-backed route handler so a dead Google refresh token
 * (ReauthRequiredError) surfaces as a 401 with code REAUTH_REQUIRED —
 * the client signs the user out to re-consent — instead of a 500.
 */
export function withReauthHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ReauthRequiredError) {
        return NextResponse.json({ error: err.message, code: "REAUTH_REQUIRED" }, { status: 401 });
      }
      throw err;
    }
  };
}
