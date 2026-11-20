import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { parseCv, type ParsedCv } from "@/lib/cv.functions";
import { toast } from "sonner";
import { FileText, Loader2, Upload, UserRound, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LinkedInLogo } from "@/components/linkedin-logo";
import type { Json } from "@/integrations/supabase/types";
import { SelfImport } from "@/components/profile/self-import";
import { CompletenessBadges } from "@/components/profile/completeness";
import { fileToBase64 } from "@/components/profile/fallback-import";
import type { NormalizedProfile } from "@/lib/profile/normalized";

import { PageHeading } from "@/components/page-heading";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile · Lockedin" },
      { name: "description", content: "Your profile and job-search goals, used to write your messages." },
      { property: "og:title", content: "My profile · Lockedin" },
      { property: "og:description", content: "Your profile and job-search goals, used to write your messages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type Normalized = {
  name?: string; headline?: string; location?: string; summary?: string;
  positions?: unknown[]; education?: unknown[]; skills?: string[]; certifications?: unknown[];
  volunteer?: unknown[]; languages?: string[]; source?: string; last_refreshed_at?: string;
};

const toList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const toLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function ProfilePage() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [f, setF] = useState({ name: "", headline: "", location: "", summary: "", roles: "", companies: "", places: "", wins: "", note: "" });
  useEffect(() => {
    if (!profile) return;
    const n = (profile.normalized_profile ?? {}) as Normalized;
    setF({
      name: n.name ?? profile.full_name ?? "",
      headline: n.headline ?? "",
      location: n.location ?? "",
      summary: n.summary ?? "",
      roles: profile.target_roles.join(", "),
      companies: profile.target_companies.join(", "),
      places: profile.preferred_locations.join(", "),
      wins: profile.accomplishments.join("\n"),
      note: profile.unique_note ?? "",
    });
  }, [profile]);
  const [extra, setExtra] = useState<Pick<ParsedCv, "positions" | "education" | "skills" | "certifications" | "languages">>({ positions: [], education: [], skills: [], certifications: [], languages: [] });
  useEffect(() => {
    const n = (profile?.normalized_profile ?? {}) as Normalized;
    setExtra({
      positions: (n.positions ?? []) as ParsedCv["positions"], education: (n.education ?? []) as ParsedCv["education"],
      skills: n.skills ?? [], certifications: (n.certifications ?? []) as string[], languages: n.languages ?? [],
    });
  }, [profile]);
  const [reading, setReading] = useState(false);
  const [cvSource, setCvSource] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const parse = useServerFn(parseCv);

  async function onCv(file: File) {
    if (file.type !== "application/pdf") { toast.error("Please upload your CV as a PDF."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("That file is over 5 MB."); return; }
    setReading(true);
    try {
      const cv = await parse({ data: { filename: file.name, base64: await fileToBase64(file), source: "cv_upload" } });
      setF((cur) => ({
        ...cur,
        name: cur.name || cv.name || "",
        headline: cv.headline ?? cur.headline,
        location: cv.location ?? cur.location,
        summary: cv.summary ?? cur.summary,
        wins: cv.accomplishments.length ? cv.accomplishments.slice(0, 5).join("\n") : cur.wins,
      }));
      setExtra({ positions: cv.positions, education: cv.education, skills: cv.skills, certifications: cv.certifications, languages: cv.languages });
      setCvSource("cv_upload");
      toast.success("CV read — check the details below, then save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that CV");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const fromLinkedIn = !!profile?.linkedin_sub;
  const [photoBroken, setPhotoBroken] = useState(false);
  const wins = toLines(f.wins);

  async function save() {
    const prev = (profile?.normalized_profile ?? {}) as Normalized;
    const normalized: Normalized = {
      volunteer: [],
      ...prev,
      ...extra,
      name: f.name.trim(), headline: f.headline.trim(), location: f.location.trim(), summary: f.summary.trim(),
      source: cvSource ?? prev.source ?? (fromLinkedIn ? "linkedin_signin" : "manual"),
      last_refreshed_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update({
      full_name: f.name.trim() || null,
      normalized_profile: normalized as unknown as Json,
      target_roles: toList(f.roles),
      target_companies: toList(f.companies),
      preferred_locations: toList(f.places),
      accomplishments: wins.slice(0, 5),
      unique_note: f.note.trim().slice(0, 300) || null,
    }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
    toast.success("Profile saved");
  }

  const settings = (profile?.settings ?? {}) as Record<string, unknown>;
  const [showImport, setShowImport] = useState<boolean | null>(null);
  const autoStart = useRef<boolean | null>(null);
  useEffect(() => {
    if (!profile || showImport !== null) return;
    const has = ((profile.normalized_profile as Normalized | null)?.positions?.length ?? 0) > 0;
    const show = !settings["self_import_done"] && !has;
    autoStart.current = show && !settings["self_import_attempted"];
    setShowImport(show);
    if (autoStart.current) void supabase.from("profiles").update({ settings: { ...settings, self_import_attempted: true } as Json }).eq("user_id", user.id);
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyImport(p: NormalizedProfile | ParsedCv) {
    const prev = (profile?.normalized_profile ?? {}) as Normalized;
    const { accomplishments, ...rest } = p as ParsedCv;
    const normalized = { ...prev, ...rest, name: prev.name || f.name || p.name, last_refreshed_at: new Date().toISOString() };
    const { error } = await supabase.from("profiles").update({
      normalized_profile: normalized as unknown as Json,
      full_name: profile?.full_name || p.name || null,
      accomplishments: profile?.accomplishments.length ? profile.accomplishments : (accomplishments ?? []).slice(0, 5),
      settings: { ...settings, self_import_attempted: true, self_import_done: true } as Json,
    }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile imported — check it below.");
    await qc.invalidateQueries({ queryKey: ["my-profile", user.id] });
  }

  if (isLoading) return <p className="text-muted-foreground">Loading your profile…</p>;

  return (
    <div className="space-y-8">
      <PageHeading icon={UserRound} title="My profile" />

      <section className="profile-identity flex items-center gap-4 tech-section">
        {profile?.avatar_url && !photoBroken
          ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setPhotoBroken(true)} className="size-20 shrink-0 rounded-md border border-primary/40 object-cover" />
          : <div className="grid size-20 shrink-0 place-items-center rounded-md border border-primary/40 bg-secondary font-display text-2xl text-primary">{(f.name || user.email || "?")[0]?.toUpperCase()}</div>}
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">{f.name || "Your name"}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          {fromLinkedIn && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><LinkedInLogo /> Name and photo imported from LinkedIn sign-in</p>}
        </div>
      </section>

      {showImport
        ? <SelfImport autoStart={!!autoStart.current} photo={profile?.avatar_url ?? null} onConfirm={applyImport} onDone={() => setShowImport(false)} />
        : showImport === false && <div className="flex items-center justify-between gap-3 text-sm"><CompletenessBadges profile={profile?.normalized_profile as Partial<NormalizedProfile> | null} /><Button variant="ghost" size="sm" onClick={() => { autoStart.current = true; setShowImport(true); }}>Import again</Button></div>}

      <section className="flex flex-col gap-4 tech-upload p-5 text-sm sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="flex items-center gap-2 font-medium"><FileText className="size-4 text-primary" /> Fill this in from your CV</p>
          <p className="mt-1 text-muted-foreground">Upload your CV or your LinkedIn "Save to PDF" file. We'll read it and fill in your jobs, schools and skills — you check everything before saving.</p>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onCv(file); }} />
        <Button onClick={() => fileRef.current?.click()} disabled={reading}>
          {reading ? <><Loader2 className="animate-spin" /> Reading your CV…</> : <><Upload /> Upload CV (PDF)</>}
        </Button>
      </section>

      <section className="tech-section">
        <h2 className="text-xl">About you</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="name" label="Name"><Input id="name" value={f.name} onChange={set("name")} /></Field>
          <Field id="loc" label="Location"><Input id="loc" placeholder="Toronto, Canada" value={f.location} onChange={set("location")} /></Field>
          <div className="sm:col-span-2"><Field id="hl" label="Headline"><Input id="hl" placeholder="Computer Science student · aspiring data analyst" value={f.headline} onChange={set("headline")} /></Field></div>
          <div className="sm:col-span-2"><Field id="sum" label="Short summary"><Textarea id="sum" rows={3} value={f.summary} onChange={set("summary")} /></Field></div>
        </div>
      </section>

      <section className="tech-section">
        <h2 className="text-xl">Experience, education & skills</h2>
        {extra.positions.length + extra.education.length + extra.skills.length === 0
          ? <p className="mt-2 text-sm text-muted-foreground">Nothing yet — upload your CV above to fill this in.</p>
          : <div className="mt-4 space-y-5 text-sm">
              {extra.positions.length > 0 && <div><h3 className="mb-2 font-medium">Experience</h3><ul className="profile-history space-y-2">{extra.positions.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-3"><span><span className="font-medium">{p.title ?? "Role"}</span>{p.company && <span className="text-muted-foreground"> · {p.company}</span>}</span><span className="shrink-0 text-xs text-muted-foreground">{[p.start, p.end].filter(Boolean).join(" – ")}</span></li>))}</ul></div>}
              {extra.education.length > 0 && <div><h3 className="mb-2 font-medium">Education</h3><ul className="profile-history space-y-2">{extra.education.map((ed, i) => (
                <li key={i} className="flex items-start justify-between gap-3"><span><span className="font-medium">{ed.school ?? "School"}</span>{(ed.degree || ed.field) && <span className="text-muted-foreground"> · {[ed.degree, ed.field].filter(Boolean).join(", ")}</span>}</span><span className="shrink-0 text-xs text-muted-foreground">{[ed.start, ed.end].filter(Boolean).join(" – ")}</span></li>))}</ul></div>}
              {extra.skills.length > 0 && <div><h3 className="mb-2 font-medium">Skills</h3><div className="profile-skills flex flex-wrap gap-2">{extra.skills.map((sk) => <span key={sk} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{sk}</span>)}</div></div>}
            </div>}
      </section>

      <section className="tech-section">
        <h2 className="text-xl">Job-search goals</h2>
        <div className="mt-4 grid gap-4">
          <Field id="roles" label="Roles you want" hint="Separate with commas"><Input id="roles" placeholder="Data Analyst, Business Analyst" value={f.roles} onChange={set("roles")} /></Field>
          <Field id="cos" label="Companies you're targeting" hint="Separate with commas"><Input id="cos" placeholder="Shopify, RBC" value={f.companies} onChange={set("companies")} /></Field>
          <Field id="places" label="Preferred locations" hint="Separate with commas"><Input id="places" placeholder="Toronto, Remote" value={f.places} onChange={set("places")} /></Field>
          <Field id="wins" label="Your best accomplishments" hint={`One per line, 3–5 (${wins.length}/5)`}>
            <Textarea id="wins" rows={4} placeholder={"Built a dashboard used by 40 people\nLed a team of 4 in a hackathon win"} value={f.wins} onChange={set("wins")} />
          </Field>
          <Field id="note" label="Anything unique about you" hint={`${f.note.length}/300`}>
            <Textarea id="note" rows={2} maxLength={300} value={f.note} onChange={set("note")} />
          </Field>
        </div>
      </section>

      <div className="border-t border-border pt-6"><Button size="lg" onClick={save}><Save /> Save profile</Button></div>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2"><Label htmlFor={id}>{label}</Label>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>
      {children}
    </div>
  );
}
