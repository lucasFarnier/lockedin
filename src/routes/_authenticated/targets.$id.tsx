import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeTarget, generateMessages, refreshTarget, type Analysis, type Variant } from "@/lib/outreach.functions";
import type { NormalizedProfile } from "@/lib/profile/normalized";
import { CompletenessBadges } from "@/components/profile/completeness";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/targets/$id")({
  head: () => ({
    meta: [
      { title: "Target · Lockedin" },
      { name: "description", content: "Common ground and message drafts for this recruiter." },
      { property: "og:title", content: "Target · Lockedin" },
      { property: "og:description", content: "Common ground and message drafts for this recruiter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TargetDetail,
});

const CHANNELS = [["connection_note", "Connection note"], ["inmail", "InMail / DM"], ["follow_up", "Follow-up"], ["thank_you", "Thank-you"], ["email", "Email"]] as const;
const GOALS = [["ask_about_role", "Ask about an open role"], ["referral", "Ask for a referral"], ["informational_chat", "Ask for a quick chat"], ["apply_follow_up", "Follow up on my application"], ["networking", "Just connect"]] as const;
const TONES = [["friendly", "Friendly"], ["professional", "Professional"], ["concise", "Concise"]] as const;
type Ch = (typeof CHANNELS)[number][0]; type Go = (typeof GOALS)[number][0]; type To = (typeof TONES)[number][0];
const STRENGTH = { strong: "bg-primary text-primary-foreground", medium: "bg-primary/15 text-primary", weak: "bg-muted text-muted-foreground" } as const;

function TargetDetail() {
  const { id } = Route.useParams();
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["target", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("targets").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const analyzeFn = useServerFn(analyzeTarget);
  const refreshFn = useServerFn(refreshTarget);
  const genFn = useServerFn(generateMessages);
  const [busy, setBusy] = useState<"refresh" | "analyze" | "gen" | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [channel, setChannel] = useState<Ch>("connection_note");
  const [goal, setGoal] = useState<Go>("ask_about_role");
  const [tone, setTone] = useState<To>("friendly");
  const [posting, setPosting] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [msgId, setMsgId] = useState<string | null>(null);
  const [limit, setLimit] = useState<number | null>(null);

  const t = q.data;
  const p = (t?.profile ?? null) as NormalizedProfile | null;
  const a = (t?.analysis ?? null) as Analysis | null;
  const autoRan = useRef(false);
  useEffect(() => {
    if (t && !t.analysis && t.profile && !autoRan.current) { autoRan.current = true; void doAnalyze(); }
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (a) setHooks(a.top_hooks); }, [t?.analysis_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = () => qc.invalidateQueries({ queryKey: ["target", id] });

  async function doRefresh() {
    setBusy("refresh");
    try {
      const r = await refreshFn({ data: { targetId: id } });
      if (!r.ok) toast.error(r.message); else { toast.success("Profile refreshed"); await analyzeFn({ data: { targetId: id } }); await reload(); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Refresh failed"); } finally { setBusy(null); }
  }
  async function doAnalyze() {
    setBusy("analyze");
    try { await analyzeFn({ data: { targetId: id } }); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Analysis failed"); } finally { setBusy(null); }
  }
  async function gen(tweak?: "regenerate" | "shorten" | "warmer" | "more_direct", base?: string) {
    setBusy("gen");
    try {
      const r = await genFn({ data: { targetId: id, channel, goal, tone, hookIds: hooks, ...(posting.trim() ? { jobPosting: posting } : {}), ...(tweak && base ? { tweak, base } : {}) } });
      setVariants(r.variants); setMsgId(r.id); setLimit(r.charLimit);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't write messages"); } finally { setBusy(null); }
  }
  async function markSent(text: string) {
    if (!msgId) return;
    const [{ error }] = await Promise.all([
      supabase.from("messages").update({ sent_text: text, sent_at: new Date().toISOString() }).eq("id", msgId),
      supabase.from("targets").update({ status: "contacted" }).eq("id", id),
    ]);
    if (error) toast.error(error.message); else { toast.success("Marked as sent"); void reload(); void qc.invalidateQueries({ queryKey: ["targets", user.id] }); }
  }

  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!t) return <p>Target not found. <Link to="/targets" className="underline">Back to targets</Link></p>;

  return (
    <div className="space-y-8">
      <Link to="/targets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Targets</Link>

      <section className="space-y-3 tech-section target-identity">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl">{p?.name ?? "Unknown name"}</h1>
            {p?.headline && <p className="text-muted-foreground">{p.headline}</p>}
            <p className="text-sm text-muted-foreground">{[p?.current_company, p?.location].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild><a href={t.linkedin_url} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open their profile</a></Button>
            <Button variant="outline" size="sm" onClick={doRefresh} disabled={!!busy}>{busy === "refresh" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh profile</Button>
          </div>
        </div>
        <CompletenessBadges profile={p} />
        {p?.last_refreshed_at && <p className="text-xs text-muted-foreground">Profile data from {new Date(p.last_refreshed_at).toLocaleDateString()}</p>}
      </section>

      <section className="space-y-4 tech-section">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl">Common ground</h2>
          <Button variant="ghost" size="sm" onClick={doAnalyze} disabled={!!busy}>{busy === "analyze" ? <Loader2 className="animate-spin" /> : <Sparkles />} {a ? "Re-run" : "Find common ground"}</Button>
        </div>
        {!a ? <p className="text-sm text-muted-foreground">Not analysed yet.</p> : (
          <>
            <div className="score-band"><span className="font-display text-6xl tabular-nums text-primary">{a.score}</span><span className="text-sm text-muted-foreground">/ 100 match</span></div>
            {a.score === 0 && a.commonalities.length === 0 && <p className="text-sm text-muted-foreground">No shared employers, schools, city or skills were found. Add more skills or target companies on My Profile, then re-run.</p>}
            {a.score_reason && <p className="text-sm text-muted-foreground">{a.score_reason}</p>}
            <p className="text-sm">{a.relevance_summary}</p>
            {(a.strengths?.length || a.gaps?.length) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="comparison-strengths"><h3 className="text-base font-medium">Your strengths</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{(a.strengths ?? []).map((x) => <li key={x}>{x}</li>)}</ul>
                  {!a.strengths?.length && <p className="mt-2 text-sm text-muted-foreground">None found.</p>}</div>
                <div className="comparison-gaps"><h3 className="text-base font-medium">What you're missing</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">{(a.gaps ?? []).map((x) => <li key={x}>{x}</li>)}</ul>
                  {!a.gaps?.length && <p className="mt-2 text-sm text-muted-foreground">No clear gaps.</p>}</div>
              </div>) : null}
            {a.commonalities.length === 0
              ? <p className="text-sm text-muted-foreground">No shared employers, schools, places or skills found. Your message will stay straightforward and honest.</p>
              : <ul className="space-y-2">{a.commonalities.map((c) => (
                  <li key={c.id}>
                    <label className="hook-option flex cursor-pointer items-start gap-3 border p-4 text-sm has-[:checked]:border-primary">
                      <input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={hooks.includes(c.id)} onChange={(e) => setHooks((h) => e.target.checked ? [...h, c.id] : h.filter((x) => x !== c.id))} />
                      <span className="flex-1"><span className="font-medium">{c.label}</span><span className="block text-xs text-muted-foreground">{c.evidence}</span></span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STRENGTH[c.strength]}`}>{c.strength}</span>
                    </label>
                  </li>))}</ul>}
            {a.commonalities.length > 0 && <p className="text-xs text-muted-foreground">Ticked items are used as hooks in your message.</p>}
          </>
        )}
      </section>

      <section className="space-y-4 tech-section">
        <h2 className="text-xl">Write a message</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Pick label="Type" value={channel} onChange={setChannel} options={CHANNELS} />
          <Pick label="Goal" value={goal} onChange={setGoal} options={GOALS} />
          <Pick label="Tone" value={tone} onChange={setTone} options={TONES} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="posting">Job posting (optional)</Label>
          <Textarea id="posting" rows={3} placeholder="Paste the job description to match your skills to it" value={posting} onChange={(e) => setPosting(e.target.value)} />
        </div>
        <Button onClick={() => gen()} disabled={!!busy}>{busy === "gen" ? <><Loader2 className="animate-spin" /> Writing…</> : <><Sparkles /> Write 3 messages</>}</Button>

        {variants.map((v, i) => (
          <VariantCard key={`${msgId}-${i}`} v={v} limit={limit} labels={new Map((a?.commonalities ?? []).map((c) => [c.id, c.label]))}
            busy={busy === "gen"} onTweak={(tw, text) => gen(tw, text)} onSent={markSent} />
        ))}
      </section>
    </div>
  );
}

function Pick<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function VariantCard({ v, limit, labels, busy, onTweak, onSent }: {
  v: Variant; limit: number | null; labels: Map<string, string>; busy: boolean;
  onTweak: (t: "regenerate" | "shorten" | "warmer" | "more_direct", text: string) => void; onSent: (text: string) => void;
}) {
  const [text, setText] = useState(v.text);
  const [copied, setCopied] = useState(false);
  const over = limit != null && text.length > limit;
  return (
    <div className="message-draft space-y-3 border">
      <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message draft" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={over ? "font-medium text-destructive" : "text-muted-foreground"}>{text.length}{limit != null ? ` / ${limit}` : ""} characters</span>
        {v.hooks_used.length > 0 && <span className="text-muted-foreground">Uses: {v.hooks_used.map((h) => labels.get(h) ?? h).join("; ")}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{v.why}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check /> : <Copy />} Copy</Button>
        <Button size="sm" variant="secondary" onClick={() => onSent(text)}>Mark as sent</Button>
        {(["shorten", "warmer", "more_direct", "regenerate"] as const).map((k) => (
          <Button key={k} size="sm" variant="ghost" disabled={busy} onClick={() => onTweak(k, text)}>{{ shorten: "Shorten", warmer: "Warmer", more_direct: "More direct", regenerate: "Regenerate" }[k]}</Button>
        ))}
      </div>
    </div>
  );
}
