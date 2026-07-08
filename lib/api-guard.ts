import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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
