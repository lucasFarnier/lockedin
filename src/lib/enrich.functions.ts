import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeLinkedInUrl } from "@/lib/profile/normalized";

/** enrich-self: by sign-in email (+ name), or by the user's own LinkedIn URL. */
export const enrichSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mode: z.enum(["email", "url"]), url: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { runLookup } = await import("@/lib/profile/lookup.server");
    if (data.mode === "url") {
      const url = normalizeLinkedInUrl(data.url ?? "");
      if (!url) throw new Error("That doesn't look like a LinkedIn profile link (linkedin.com/in/…).");
      return runLookup({ userId: context.userId, kind: "self_url", query: { profileUrl: url }, cacheKey: url });
    }
    const email = String(context.claims.email ?? "").toLowerCase();
    if (!email) throw new Error("Your account has no email address.");
    const { data: prof } = await context.supabase.from("profiles").select("full_name").eq("user_id", context.userId).maybeSingle();
    return runLookup({ userId: context.userId, kind: "self_email", query: prof?.full_name ? { email, name: prof.full_name } : { email }, cacheKey: `email:${email}` });
  });

/** enrich-target: by normalized LinkedIn URL. */
export const enrichTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().max(500), refresh: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const url = normalizeLinkedInUrl(data.url);
    if (!url) throw new Error("That doesn't look like a LinkedIn profile link (linkedin.com/in/…).");
    const { runLookup } = await import("@/lib/profile/lookup.server");
    const out = await runLookup({ userId: context.userId, kind: "target", query: { profileUrl: url }, cacheKey: url, refresh: data.refresh });
    return { url, ...out };
  });

export const getLookupUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("@/lib/profile/lookup.server")).usageThisMonth(context.userId));

/** Dev-only probe: raw provider response next to the normalized result. Disabled in the published app. */
export const devProbe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ input: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!import.meta.env.DEV) throw new Error("Not available");
    const isEmail = data.input.includes("@") && !data.input.includes("linkedin.com");
    const url = isEmail ? null : normalizeLinkedInUrl(data.input);
    if (!isEmail && !url) throw new Error("Enter an email or a linkedin.com/in/… link.");
    const { runLookup } = await import("@/lib/profile/lookup.server");
    const out = await runLookup({ userId: context.userId, kind: "dev", query: isEmail ? { email: data.input.toLowerCase() } : { profileUrl: url! }, cacheKey: isEmail ? `email:${data.input.toLowerCase()}` : url!, includeRaw: true });
    return { query: isEmail ? `email=${data.input}` : `profile=${url}`, outcome: out };
  });
