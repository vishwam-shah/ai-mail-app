export async function fetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Google refused our refresh token (expired/revoked) — the only fix is a
    // fresh consent, so sign out and land on the login page instead of
    // showing a permanently broken inbox.
    if (res.status === 401 && body.code === "REAUTH_REQUIRED" && typeof window !== "undefined") {
      const { signOut } = await import("next-auth/react");
      await signOut({ callbackUrl: "/login" });
    }
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
