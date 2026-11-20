import { CACHE_TTL_DAYS, GLOBAL_MONTHLY_CAP, RAW_LOG_FIRST_N, USER_MONTHLY_LIMIT, providerChain, type EnrichQuery } from "./providers.server";
import type { NormalizedProfile } from "./normalized";

export type LookupKind = "self_email" | "self_url" | "target" | "dev";
export type LookupOutcome =
  | { status: "ok"; profile: NormalizedProfile; cached: boolean; provider: string; likelihood: number | null; raw?: string }
  | { status: "not_found"; raw?: string }
  | { status: "unavailable"; reason: "not_configured" | "limit" | "global_limit" | "limit_reached" | "error"; message: string; raw?: string };

const SELF_MONTHLY_LIMIT = 3;
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };

async function admin() { return (await import("@/integrations/supabase/client.server")).supabaseAdmin; }

export async function usageThisMonth(userId: string) {
  const db = await admin();
  const since = monthStart();
  const [{ count: targets }, { count: self }] = await Promise.all([
    db.from("provider_calls").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("counted", true).eq("kind", "target").gte("created_at", since),
    db.from("provider_calls").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("counted", true).in("kind", ["self_email", "self_url"]).gte("created_at", since),
  ]);
  return { used: targets ?? 0, limit: USER_MONTHLY_LIMIT(), selfUsed: self ?? 0, selfLimit: SELF_MONTHLY_LIMIT };
}

export async function runLookup(opts: { userId: string; kind: LookupKind; query: EnrichQuery; cacheKey: string; refresh?: boolean; includeRaw?: boolean }): Promise<LookupOutcome> {
  const db = await admin();
  const { userId, kind, query, cacheKey } = opts;

  if (!opts.refresh && kind !== "dev") {
    const { data: hit } = await db.from("enriched_profiles_cache").select("profile, provider, fetched_at").eq("cache_key", cacheKey).maybeSingle();
    if (hit && Date.now() - new Date(hit.fetched_at).getTime() < CACHE_TTL_DAYS * 864e5) {
      await db.from("provider_calls").insert({ user_id: userId, provider: hit.provider, kind, query: cacheKey, outcome: "cache_hit", counted: false });
      return { status: "ok", profile: hit.profile as unknown as NormalizedProfile, cached: true, provider: hit.provider, likelihood: null };
    }
  }

  const chain = providerChain();
  if (!chain.length) return { status: "unavailable", reason: "not_configured", message: "Profile lookup isn't set up." };

  if (kind !== "dev") {
    const u = await usageThisMonth(userId);
    if (kind === "target" && u.used >= u.limit) return { status: "unavailable", reason: "limit", message: `You've used all ${u.limit} profile lookups this month.` };
    if (kind !== "target" && u.selfUsed >= u.selfLimit) return { status: "unavailable", reason: "limit", message: "You've used this month's lookups for your own profile." };
  }
  const { count: global } = await db.from("provider_calls").select("id", { count: "exact", head: true }).eq("counted", true).neq("provider", "mock").gte("created_at", monthStart());
  if ((global ?? 0) >= GLOBAL_MONTHLY_CAP() && chain.every((p) => p.id !== "mock")) {
    return { status: "unavailable", reason: "global_limit", message: "The app's free lookups for this month are used up." };
  }

  let last: LookupOutcome | null = null;
  for (const p of chain) {
    let r;
    try { r = await p.enrich(query); } catch (e) { console.error("[lookup] provider threw", e); r = { kind: "error" as const, message: e instanceof Error ? e.message : "failed", raw: { thrown: e instanceof Error ? `${e.message} ${e.stack?.split("\n")[1] ?? ""}` : String(e) }, httpStatus: null }; }
    const notConfigured = r.kind === "error" && r.message === "not_configured";
    const { count: logged } = await db.from("provider_calls").select("id", { count: "exact", head: true }).not("raw_response", "is", null);
    const rawText = r.raw == null ? null : JSON.stringify(r.raw).slice(0, 20000);
    if (!notConfigured) {
      await db.from("provider_calls").insert({
        user_id: userId, provider: p.id, kind, query: cacheKey,
        outcome: r.kind === "ok" ? "matched" : r.kind === "error" && r.message === "limit_reached" ? "limit_reached" : r.kind, http_status: r.httpStatus,
        likelihood: r.kind === "ok" ? r.likelihood : null,
        counted: r.kind !== "error" || (r.httpStatus ?? 0) < 500,
        raw_response: (logged ?? 0) < RAW_LOG_FIRST_N ? rawText : null,
      });
    }
    const raw = opts.includeRaw ? { raw: JSON.stringify(r.raw ?? null) } : {};
    if (r.kind === "ok") {
      if (kind !== "dev") await db.from("enriched_profiles_cache").upsert({ cache_key: cacheKey, provider: p.id, profile: r.profile as never, fetched_at: new Date().toISOString() });
      return { status: "ok", profile: r.profile, cached: false, provider: p.id, likelihood: r.likelihood, ...raw };
    }
    if (r.kind === "not_found") last = { status: "not_found", ...raw };
    else if (last?.status !== "not_found") {
      const limited = r.kind === "error" && r.message === "limit_reached";
      last = { status: "unavailable", reason: notConfigured ? "not_configured" : limited ? "limit_reached" : "error",
        message: notConfigured ? "Profile lookup isn't set up yet." : limited ? "Our free profile lookups are used up for now." : "The lookup service had a problem.", ...raw };
    }
  }
  return last ?? { status: "not_found" };
}
