import { createFileRoute } from "@tanstack/react-router";
import { LINKEDIN_STATE_COOKIE, linkedInSignInOrigin, backToAuth, callbackUrl } from "@/lib/linkedin-oauth.server";

export const Route = createFileRoute("/api/public/linkedin/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = linkedInSignInOrigin();
        const clientId = process.env["LINKEDIN_CLIENT_ID"];
        if (!origin || !clientId || !process.env["LINKEDIN_CLIENT_SECRET"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          return backToAuth(null, { error: "LinkedIn sign-in isn't set up yet" });
        }
        // Start on the callback's host so the state cookie survives the return from LinkedIn.
        if (new URL(request.url).origin !== origin) {
          return Response.redirect(`${origin}/api/public/linkedin/start`, 302);
        }
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        const state = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", clientId);
        const redirectUri = callbackUrl(origin);
        url.searchParams.set("redirect_uri", redirectUri);
        url.searchParams.set("scope", "openid profile email");
        url.searchParams.set("state", state);
        const headers = new Headers({ Location: url.toString(), "Cache-Control": "no-store" });
        headers.append("Set-Cookie", `${LINKEDIN_STATE_COOKIE}=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
