// Server-only helpers for our own LinkedIn OpenID Connect flow.
// LinkedIn's token endpoint only accepts the client secret in the POST body (client_secret_post).
export const LINKEDIN_STATE_COOKIE = "li_oauth_state";
export function linkedInSignInOrigin(value = process.env["LINKEDIN_SIGN_IN_ORIGIN"]) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value === url.origin ? value : null;
  } catch {
    return null;
  }
}

export function callbackUrl(origin: string) {
  return `${origin}/api/public/linkedin/callback`;
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) {
      try {
        return decodeURIComponent(v.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function backToAuth(origin: string | null, result: { error: string } | { token: string }) {
  const suffix = "token" in result
    ? `#${new URLSearchParams({ li_token: result.token })}`
    : `?${new URLSearchParams({ error_description: result.error })}`;
  const headers = new Headers({
    Location: `${origin ?? ""}/auth${suffix}`,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Set-Cookie": `${LINKEDIN_STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  });
  return new Response(null, { status: 302, headers });
}
