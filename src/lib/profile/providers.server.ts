import { emptyProfile, completeness, type NormalizedProfile } from "./normalized";

export type EnrichQuery = { email?: string; name?: string; profileUrl?: string };
export type EnrichResult =
  | { kind: "ok"; profile: NormalizedProfile; raw: unknown; httpStatus: number; likelihood: number | null }
  | { kind: "not_found"; raw: unknown; httpStatus: number }
  | { kind: "error"; message: string; raw: unknown; httpStatus: number | null };

export interface ProfileProvider {
  id: string;
  enrich(q: EnrichQuery): Promise<EnrichResult>;
}

type PdlName = { name?: string | null } | string | null | undefined;
// PDL free plans return `true`/`false` in place of gated fields, so accept only real strings.
const S = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const nm = (v: unknown) => S(typeof v === "object" && v ? (v as { name?: unknown }).name : v);
const tc = (v: unknown) => { const s = S(v); return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : null; };
const ym = (d: unknown) => S(d)?.slice(0, 7) ?? null;

// deno-lint-ignore no-explicit-any
export function mapPdl(d: any): NormalizedProfile {
  const p = emptyProfile("pdl");
  p.name = tc(d.full_name);
  p.headline = S(d.headline) ?? (S(d.job_title) ? tc(d.job_title + (S(d.job_company_name) ? ` at ${d.job_company_name}` : "")) : null);
  p.location = tc(d.location_name);
  p.summary = S(d.summary);
  p.current_company = tc(d.job_company_name);
  p.linkedin_url = S(d.linkedin_url) ? `https://www.${String(d.linkedin_url).replace(/^https?:\/\/(www\.)?/, "")}` : null;
  p.positions = (Array.isArray(d.experience) ? d.experience : [])
    .map((e: { title?: PdlName; company?: PdlName; start_date?: string; end_date?: string; summary?: string; is_primary?: boolean }) => ({
      title: tc(nm(e.title)), company: tc(nm(e.company)), start: ym(e.start_date), end: e.end_date ? ym(e.end_date) : (e.is_primary ? "Present" : null), description: S(e.summary),
    }))
    .sort((a: { start: string | null }, b: { start: string | null }) => (b.start ?? "").localeCompare(a.start ?? ""));
  p.education = (Array.isArray(d.education) ? d.education : []).map(
    (e: { school?: PdlName; degrees?: string[]; majors?: string[]; start_date?: string; end_date?: string }) => ({
      school: tc(nm(e.school)), degree: S(Array.isArray(e.degrees) ? e.degrees[0] : null), field: tc(Array.isArray(e.majors) ? e.majors[0] : null), start: ym(e.start_date), end: ym(e.end_date),
    }));
  p.skills = Array.isArray(d.skills) ? d.skills.map(tc).filter(Boolean).slice(0, 40) : [];
  p.certifications = (Array.isArray(d.certifications) ? d.certifications : []).map((c: PdlName) => nm(c)).filter(Boolean);
  p.languages = (Array.isArray(d.languages) ? d.languages : []).map((l: PdlName) => tc(nm(l))).filter(Boolean);
  return p;
}

const pdl: ProfileProvider = {
  id: "pdl",
  async enrich(q) {
    const key = process.env["PDL_API_KEY"];
    if (!key) return { kind: "error", message: "not_configured", raw: null, httpStatus: null };
    const params = new URLSearchParams({ titlecase: "false", min_likelihood: "6" });
    if (q.profileUrl) params.set("profile", q.profileUrl.replace(/^https?:\/\/(www\.)?/, ""));
    if (q.email) params.set("email", q.email);
    if (q.name) params.set("name", q.name);
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, { headers: { "X-Api-Key": key } });
    const raw = await res.json().catch(() => null);
    if (res.status === 402 || res.status === 429) return { kind: "error", message: "limit_reached", raw, httpStatus: res.status };
    if (res.status === 404) return { kind: "not_found", raw, httpStatus: 404 };
    if (!res.ok || !raw?.data) return { kind: "error", message: raw?.error?.message ?? `HTTP ${res.status}`, raw, httpStatus: res.status };
    return { kind: "ok", profile: mapPdl(raw.data), raw, httpStatus: res.status, likelihood: typeof raw.likelihood === "number" ? raw.likelihood : null };
  },
};

// Only used when PROFILE_PROVIDER=mock, for testing the flow without spending lookups.
const mock: ProfileProvider = {
  id: "mock",
  async enrich(q) {
    if ((q.email ?? q.profileUrl ?? "").includes("notfound")) return { kind: "not_found", raw: { status: 404 }, httpStatus: 404 };
    const raw = { status: 200, likelihood: 8, data: { full_name: q.name ?? "sam example", job_title: "talent acquisition partner", job_company_name: "acme",
      location_name: "toronto, ontario, canada", experience: [{ title: { name: "talent acquisition partner" }, company: { name: "acme" }, start_date: "2021-03", is_primary: true }],
      education: [{ school: { name: "university of toronto" }, degrees: ["bachelors"], majors: ["psychology"], start_date: "2014", end_date: "2018" }], skills: ["recruiting", "sourcing"] } };
    return { kind: "ok", profile: mapPdl(raw.data), raw, httpStatus: 200, likelihood: 8 };
  },
};

const PROVIDERS: Record<string, ProfileProvider> = { pdl, mock };

/** Active provider from PROFILE_PROVIDER (default pdl), then optional PROFILE_PROVIDER_FALLBACKS (comma list). */
export function providerChain(): ProfileProvider[] {
  const ids = [process.env["PROFILE_PROVIDER"] || "pdl", ...(process.env["PROFILE_PROVIDER_FALLBACKS"] ?? "").split(",")]
    .map((s) => s.trim()).filter(Boolean);
  return [...new Set(ids)].map((id) => PROVIDERS[id]).filter((p): p is ProfileProvider => !!p);
}

export const RAW_LOG_FIRST_N = 20;
export const CACHE_TTL_DAYS = 30;
export const USER_MONTHLY_LIMIT = () => Number(process.env["LOOKUP_LIMIT_PER_USER"] ?? 5);
export const GLOBAL_MONTHLY_CAP = () => Number(process.env["LOOKUP_GLOBAL_MONTHLY_CAP"] ?? 95); // PDL free tier is 100/month

export { completeness };
