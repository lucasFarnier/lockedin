import { createFileRoute } from "@tanstack/react-router";
import { LINKEDIN_STATE_COOKIE, backToAuth, callbackUrl, linkedInSignInOrigin, readCookie } from "@/lib/linkedin-oauth.server";

type LinkedInUser = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string; given_name?: string; family_name?: string };

export const Route = createFileRoute("/api/public/linkedin/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = linkedInSignInOrigin();
        const clientId = process.env["LINKEDIN_CLIENT_ID"];
        const clientSecret = process.env["LINKEDIN_CLIENT_SECRET"];
        const fail = (error: string) => backToAuth(null, { error });
        if (!origin || !clientId || !clientSecret || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
          return fail("LinkedIn sign-in isn't set up yet");
        }
        if (url.origin !== origin || url.searchParams.has("error")) return fail("LinkedIn sign-in did not finish.");

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const expected = readCookie(request, LINKEDIN_STATE_COOKIE);
        if (!code || !state || !expected || state !== expected) return fail("Sign-in expired or was started in another tab. Please try again.");
        const redirectUri = callbackUrl(origin);

        // client_secret_post: credentials in the form body, as LinkedIn requires.
        const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
        });
        const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
        if (!tokenRes.ok || !tokenJson.access_token) return fail("LinkedIn rejected the sign-in.");

        const infoRes = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${tokenJson.access_token}` } });
        if (!infoRes.ok) return fail(`Couldn't read your LinkedIn profile (${infoRes.status})`);
        const li = (await infoRes.json()) as LinkedInUser;
        if (!li.sub || !li.email || li.email_verified !== true) return fail("Your LinkedIn account has no verified email address.");
        const email = li.email.toLowerCase();
        const fullName = li.name ?? [li.given_name, li.family_name].filter(Boolean).join(" ");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Create the account if new (email verified by LinkedIn); ignore "already registered".
        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: fullName, avatar_url: li.picture, linkedin_sub: li.sub },
        });
        if (created.error && created.error.code !== "email_exists") return fail("Couldn't set up your account.");

        const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
        const tokenHash = link.data?.properties?.hashed_token;
        const userId = link.data?.user?.id;
        if (link.error || !tokenHash || !userId) return fail("Couldn't start your session.");

        await supabaseAdmin.from("profiles").update({ linkedin_sub: li.sub }).eq("user_id", userId);
        await supabaseAdmin.from("profiles").update({ full_name: fullName || null, avatar_url: li.picture ?? null }).eq("user_id", userId).is("full_name", null);

        return backToAuth(origin, { token: tokenHash });
      },
    },
  },
});
