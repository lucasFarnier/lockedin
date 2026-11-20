// Client-safe: one normalized profile shape used everywhere.
export type Position = { title: string | null; company: string | null; start: string | null; end: string | null; description: string | null };
export type Education = { school: string | null; degree: string | null; field: string | null; start: string | null; end: string | null };
export type NormalizedProfile = {
  name: string | null; headline: string | null; location: string | null; summary: string | null;
  current_company: string | null; photo_url: string | null; linkedin_url: string | null;
  positions: Position[]; education: Education[]; skills: string[]; certifications: string[];
  volunteer: string[]; languages: string[];
  source: string; last_refreshed_at: string;
};

export function emptyProfile(source: string): NormalizedProfile {
  return { name: null, headline: null, location: null, summary: null, current_company: null, photo_url: null, linkedin_url: null,
    positions: [], education: [], skills: [], certifications: [], volunteer: [], languages: [], source, last_refreshed_at: new Date().toISOString() };
}

export type Completeness = { experience: boolean; education: boolean; skills: boolean; thin: boolean };
export function completeness(p: Partial<NormalizedProfile> | null | undefined): Completeness {
  const experience = (p?.positions?.length ?? 0) > 0;
  const education = (p?.education?.length ?? 0) > 0;
  const skills = (p?.skills?.length ?? 0) > 0;
  return { experience, education, skills, thin: !experience };
}

/** Returns https://www.linkedin.com/in/<slug> or null. Strips tracking params, locale paths, trailing slashes. */
export function normalizeLinkedInUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/in\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  let slug: string;
  try { slug = decodeURIComponent(m[1]).toLowerCase(); } catch { return null; }
  if (!/^[\p{L}\p{N}_-]{3,100}$/u.test(slug)) return null;
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
}
