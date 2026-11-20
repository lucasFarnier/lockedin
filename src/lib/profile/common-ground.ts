// Client-safe, deterministic matching. The AI only ranks and words these facts; it never adds new ones.
import type { NormalizedProfile } from "./normalized";

export type Evidence = { id: string; category: "overlap" | "employer" | "school" | "location" | "skills" | "field" | "target_company"; strength: "strong" | "medium" | "weak"; evidence: string };
export type MyGoals = { target_companies: string[]; target_roles: string[] };

const org = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[.,]/g, "").replace(/\b(inc|ltd|llc|corp|corporation|co|limited|the)\b/g, "").replace(/\s+/g, " ").trim();
const yr = (s: string | null | undefined, end = false): number | null => {
  if (!s) return end ? null : null;
  if (/present/i.test(s)) return new Date().getFullYear() + 0.99;
  const m = s.match(/(\d{4})(?:-(\d{2}))?/);
  return m ? Number(m[1]) + (m[2] ? (Number(m[2]) - 1) / 12 : 0) : null;
};
const overlaps = (a0: number | null, a1: number | null, b0: number | null, b1: number | null) =>
  a0 != null && b0 != null && a0 <= (b1 ?? a0 + 1) && b0 <= (a1 ?? b0 + 1);
const city = (s: string | null | undefined) => (s ?? "").split(",")[0]?.trim().toLowerCase() ?? "";

export function findCommonGround(me: Partial<NormalizedProfile>, them: Partial<NormalizedProfile>, goals: MyGoals): Evidence[] {
  const out: Evidence[] = [];
  const seen = new Set<string>();
  for (const a of me.positions ?? []) for (const b of them.positions ?? []) {
    const k = org(a.company);
    if (!k || k !== org(b.company) || seen.has(k)) continue;
    seen.add(k);
    const both = overlaps(yr(a.start), yr(a.end, true), yr(b.start), yr(b.end, true));
    out.push({ id: `org:${k}`, category: both ? "overlap" : "employer", strength: both ? "strong" : "medium",
      evidence: both ? `You both worked at ${b.company} at the same time` : `You both worked at ${b.company}` });
  }
  const schools = new Set<string>();
  for (const a of me.education ?? []) for (const b of them.education ?? []) {
    const k = org(a.school);
    if (!k || k !== org(b.school) || schools.has(k)) continue;
    schools.add(k);
    const both = overlaps(yr(a.start), yr(a.end), yr(b.start), yr(b.end));
    out.push({ id: `school:${k}`, category: "school", strength: both ? "strong" : "medium",
      evidence: both ? `You were both at ${b.school} at the same time` : `You both studied at ${b.school}` });
    if (a.field && b.field && org(a.field) === org(b.field)) out.push({ id: `field:${org(a.field)}`, category: "field", strength: "weak", evidence: `You both studied ${b.field}` });
  }
  const c = city(me.location);
  if (c && c === city(them.location)) out.push({ id: `loc:${c}`, category: "location", strength: "weak", evidence: `You're both based in ${them.location?.split(",")[0]}` });
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  const mine = (me.skills ?? []).map(norm).filter((x) => x.length >= 2);
  // Exact match, or one phrase contains the other as whole words ("python" ~ "python programming").
  const like = (a: string, b: string) => a === b || ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);
  const shared = [...new Set((them.skills ?? []).filter((s) => { const n = norm(s); return n.length >= 2 && mine.some((m) => like(m, n)); }))];
  if (shared.length) out.push({ id: "skills", category: "skills", strength: shared.length >= 3 ? "medium" : "weak", evidence: `Shared skills: ${shared.slice(0, 6).join(", ")}` });
  const co = org(them.current_company ?? them.positions?.[0]?.company);
  if (co && goals.target_companies.some((t) => org(t) === co)) out.push({ id: `target:${co}`, category: "target_company", strength: "medium", evidence: `They work at ${them.current_company ?? them.positions?.[0]?.company}, a company you're targeting` });
  return out;
}

const W = { strong: 35, medium: 18, weak: 8 } as const;
export const commonGroundScore = (ev: Evidence[]) => Math.min(100, ev.reduce((n, e) => n + W[e.strength], 0));
