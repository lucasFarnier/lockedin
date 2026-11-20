import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NormalizedProfile } from "@/lib/profile/normalized";
import { commonGroundScore, findCommonGround, type Evidence } from "@/lib/profile/common-ground";
import type { Json } from "@/integrations/supabase/types";

export type Analysis = {
  commonalities: (Evidence & { label: string })[];
  relevance_summary: string;
  score: number;
  top_hooks: string[];
  /** AI-judged fit; falls back to the rule-based score on old analyses. */
  score_reason?: string;
  strengths?: string[];
  gaps?: string[];
};
export type Variant = { text: string; hooks_used: string[]; why: string };

const compact = (p: Partial<NormalizedProfile> | null) => ({
  name: p?.name, headline: p?.headline, location: p?.location, current_company: p?.current_company,
  summary: p?.summary?.slice(0, 400),
  positions: (p?.positions ?? []).slice(0, 6).map((x) => `${x.title ?? ""} @ ${x.company ?? ""} (${x.start ?? "?"}–${x.end ?? "?"})`),
  education: (p?.education ?? []).slice(0, 4).map((e) => `${e.school ?? ""} ${[e.degree, e.field].filter(Boolean).join(", ")}`),
  skills: (p?.skills ?? []).slice(0, 25),
});

async function load(ctx: { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string }, targetId: string) {
  const [{ data: t, error }, { data: me }] = await Promise.all([
    ctx.supabase.from("targets").select("*").eq("id", targetId).maybeSingle(),
    ctx.supabase.from("profiles").select("*").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  if (error || !t) throw new Error("Target not found");
  return { t, me };
}

const ANALYSIS_PROMPT = `You rate fit, and rank and word "common ground", between a job seeker (ME) and a recruiter/hiring manager (THEM).
You receive a list of EVIDENCE items already verified by code. Use ONLY those items — never add, infer or embellish shared experiences, mutual connections or facts.
For each evidence item write a short label (max 12 words). Order commonalities from most to least useful for a cold message.
relevance_summary: 1–2 sentences addressed to ME as "you" (e.g. "Your Python skills…"), never mentioning "evidence" or the word ME, on why ME is relevant to THEM's company/role, using only facts present in the two profiles. If evidence is empty or weak, say so plainly.
top_hooks: up to 3 evidence ids, best first. Return [] if there is no evidence.
score: 0–100 — how well ME fits THEM's company/role/team, judged from both profiles (relevant experience, skills, seniority, field) plus the evidence. 0–30 weak, 31–60 partial, 61–85 good, 86+ excellent. Be honest, not generous.
score_reason: one sentence explaining the score, addressed to "you".
strengths: up to 5 short bullets (max 15 words) — things in ME's profile that match what THEM's company/role/background suggests they value. Only facts from ME.
gaps: up to 5 short bullets (max 15 words) — skills, experience or qualifications THEM has or their role clearly implies that ME's profile does not show. Phrase as "Your profile doesn't show …". Never claim ME lacks something listed in ME.`;

const analysisSchema = {
  type: "object", additionalProperties: false, required: ["commonalities", "relevance_summary", "top_hooks", "score", "score_reason", "strengths", "gaps"],
  properties: {
    commonalities: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "label"], properties: { id: { type: "string" }, label: { type: "string" } } } },
    relevance_summary: { type: "string" },
    top_hooks: { type: "array", items: { type: "string" } },
    score: { type: "integer" },
    score_reason: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
  },
};

/** Common Ground: deterministic matching first, then AI ranks/words only that evidence. */
export const analyzeTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ targetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Analysis> => {
    const { t, me } = await load(context, data.targetId);
    const mine = (me?.normalized_profile ?? {}) as Partial<NormalizedProfile>;
    const theirs = (t.profile ?? {}) as Partial<NormalizedProfile>;
    const evidence = findCommonGround(mine, theirs, { target_companies: me?.target_companies ?? [], target_roles: me?.target_roles ?? [] });
    const { aiJson } = await import("@/lib/profile/ai-extract.server");
    const ai = await aiJson<{ commonalities: { id: string; label: string }[]; relevance_summary: string; top_hooks: string[]; score: number; score_reason: string; strengths: string[]; gaps: string[] }>(
      ANALYSIS_PROMPT,
      [{ type: "input_text", text: JSON.stringify({ EVIDENCE: evidence, ME: { ...compact(mine), target_roles: me?.target_roles ?? [] }, THEM: compact(theirs) }) }],
      "common_ground", analysisSchema,
    );
    const byId = new Map(evidence.map((e) => [e.id, e]));
    const ordered = ai.commonalities.filter((c) => byId.has(c.id)).map((c) => ({ ...byId.get(c.id)!, label: c.label }));
    for (const e of evidence) if (!ordered.some((o) => o.id === e.id)) ordered.push({ ...e, label: e.evidence });
    const analysis: Analysis = { commonalities: ordered, relevance_summary: ai.relevance_summary, score: Number.isFinite(ai.score) ? Math.max(0, Math.min(100, Math.round(ai.score))) : commonGroundScore(evidence),
      score_reason: ai.score_reason, strengths: ai.strengths.slice(0, 5), gaps: ai.gaps.slice(0, 5),
      top_hooks: ai.top_hooks.filter((h) => byId.has(h)).slice(0, 3) };
    await context.supabase.from("targets").update({ analysis: analysis as unknown as Json, analysis_at: new Date().toISOString() }).eq("id", t.id);
    return analysis;
  });

/** Refresh a saved target's profile from the provider, bypassing the cache. */
export const refreshTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ targetId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { t } = await load(context, data.targetId);
    const { runLookup } = await import("@/lib/profile/lookup.server");
    const r = await runLookup({ userId: context.userId, kind: "target", query: { profileUrl: t.linkedin_url }, cacheKey: t.linkedin_url, refresh: true });
    if (r.status !== "ok") return { ok: false as const, message: r.status === "not_found" ? "No newer data found for this profile." : r.message };
    await context.supabase.from("targets").update({ profile: r.profile as unknown as Json, updated_at: new Date().toISOString() }).eq("id", t.id);
    return { ok: true as const };
  });

const CHANNELS = ["connection_note", "inmail", "follow_up", "thank_you", "email"] as const;
const GOALS = ["referral", "informational_chat", "ask_about_role", "apply_follow_up", "networking"] as const;
const TONES = ["friendly", "professional", "concise"] as const;
const TWEAKS = ["regenerate", "shorten", "warmer", "more_direct"] as const;

const MESSAGE_PROMPT = `You write short LinkedIn outreach messages from a job seeker (ME) to a recruiter or hiring manager (THEM). The user copies and sends them manually.
Hard rules:
- State ONLY facts present in ME, THEM or SELECTED_HOOKS. Never invent shared experiences, mutual connections, compliments, job openings or details about THEM.
- Open with the most specific selected hook. If there are no hooks, write a straightforward, honest message that relates ME's real experience/skills to THEM's company or role — no fake common ground.
- Use THEM's first name. One clear, low-pressure ask that matches GOAL. No flattery. Never write "I hope this finds you well" or similar filler.
- Direct messages under ~80 words. CHAR_LIMIT is a hard maximum on characters when given.
- If JOB_POSTING is given, connect ME's real skills to its requirements.
- Write 3 distinct variants. hooks_used: ids from SELECTED_HOOKS actually used. why: one sentence on why this variant works.
- For "email" channel, the first line is "Subject: …".`;

const msgSchema = {
  type: "object", additionalProperties: false, required: ["variants"],
  properties: { variants: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "hooks_used", "why"],
    properties: { text: { type: "string" }, hooks_used: { type: "array", items: { type: "string" } }, why: { type: "string" } } } } },
};

export const generateMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetId: z.string().uuid(), channel: z.enum(CHANNELS), goal: z.enum(GOALS), tone: z.enum(TONES),
    hookIds: z.array(z.string().max(200)).max(5), jobPosting: z.string().max(6000).optional(),
    tweak: z.enum(TWEAKS).optional(), base: z.string().max(3000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { t, me } = await load(context, data.targetId);
    const settings = (me?.settings ?? {}) as { note_limit?: number };
    const charLimit = data.channel === "connection_note" ? settings.note_limit ?? 300 : null;
    const analysis = t.analysis as unknown as Analysis | null;
    const hooks = (analysis?.commonalities ?? []).filter((c) => data.hookIds.includes(c.id)).map((c) => ({ id: c.id, fact: c.evidence }));
    const tweakText = data.tweak && data.base ? `\nTWEAK: ${data.tweak} — rewrite this draft accordingly (3 variants):\n${data.base}` : "";
    const { aiJson } = await import("@/lib/profile/ai-extract.server");
    const out = await aiJson<{ variants: Variant[] }>(MESSAGE_PROMPT, [{ type: "input_text", text: JSON.stringify({
      CHANNEL: data.channel, GOAL: data.goal, TONE: data.tone, CHAR_LIMIT: charLimit,
      ME: { ...compact((me?.normalized_profile ?? {}) as Partial<NormalizedProfile>), target_roles: me?.target_roles, accomplishments: me?.accomplishments, unique_note: me?.unique_note },
      THEM: compact(t.profile as Partial<NormalizedProfile>), SELECTED_HOOKS: hooks, JOB_POSTING: data.jobPosting || null,
    }) + tweakText }], "messages", msgSchema);
    const valid = new Set(hooks.map((h) => h.id));
    const variants = out.variants.slice(0, 3).map((v) => ({ ...v, hooks_used: v.hooks_used.filter((h) => valid.has(h)) }));
    const { data: row, error } = await context.supabase.from("messages").insert({
      user_id: context.userId, target_id: t.id, channel: data.channel, goal: data.goal, tone: data.tone, variants: variants as unknown as Json,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id, variants, charLimit };
  });
