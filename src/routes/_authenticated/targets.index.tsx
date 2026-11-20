import { createFileRoute, Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, RefreshCw, Search, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { enrichTarget, getLookupUsage } from "@/lib/enrich.functions";
import { analyzeTarget } from "@/lib/outreach.functions";
import { completeness, normalizeLinkedInUrl, type NormalizedProfile } from "@/lib/profile/normalized";
import { CompletenessBadges } from "@/components/profile/completeness";
import { FallbackImport } from "@/components/profile/fallback-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { PageHeading } from "@/components/page-heading";

export const Route = createFileRoute("/_authenticated/targets/")({
  head: () => ({
    meta: [
      { title: "Targets · Lockedin" },
      { name: "description", content: "Recruiters and hiring managers you want to message." },
      { property: "og:title", content: "Targets · Lockedin" },
      { property: "og:description", content: "Recruiters and hiring managers you want to message." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TargetsPage,
});

type Found = { url: string; profile: NormalizedProfile | null; note: string | null; cached?: boolean; rejected?: boolean };

function TargetsPage() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const lookup = useServerFn(enrichTarget);
  const usageFn = useServerFn(getLookupUsage);
  const usage = useQuery({ queryKey: ["lookup-usage"], queryFn: () => usageFn() });
  const list = useQuery({
    queryKey: ["targets", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("targets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeTarget);

  async function run(refresh = false, target = url) {
    const norm = normalizeLinkedInUrl(target);
    if (!norm) { toast.error("Paste a LinkedIn profile link like linkedin.com/in/jane-doe"); return; }
    setBusy(true);
    try {
      const r = await lookup({ data: { url: norm, refresh } });
      if (r.status === "ok") setFound({ url: r.url, profile: r.profile, cached: r.cached, note: completeness(r.profile).thin ? "We found them, but without any work history. Add their PDF or profile text for better messages." : null });
      else setFound({ url: r.url, profile: null, note: r.status === "not_found" ? "We couldn't find this person in our lookup service." : r.reason === "limit" || r.reason === "global_limit" || r.reason === "limit_reached" ? `${r.message} You can still add them yourself below — it's free.` : r.message });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Lookup failed"); }
    finally { setBusy(false); void qc.invalidateQueries({ queryKey: ["lookup-usage"] }); }
  }

  async function save() {
    if (!found?.profile) return;
    setSaving(true);
    const { data, error } = await supabase.from("targets").upsert({ user_id: user.id, linkedin_url: found.url, profile: found.profile as unknown as Json, updated_at: new Date().toISOString() }, { onConflict: "user_id,linkedin_url" }).select("id").single();
    if (error) { setSaving(false); toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["targets", user.id] });
    try { await analyze({ data: { targetId: data.id } }); }
    catch (e) { toast.error(e instanceof Error ? `Saved, but Common Ground failed: ${e.message}` : "Saved, but Common Ground failed"); }
    setSaving(false);
    void navigate({ to: "/targets/$id", params: { id: data.id } });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("targets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["targets", user.id] });
  }

  return (
    <div className="space-y-8">
      <PageHeading icon={Users} title="Targets">
        {usage.data && <p className="font-display text-success">{usage.data.used} of {usage.data.limit} lookups used this month</p>}
      </PageHeading>

      <form className="flex flex-col gap-3 border-b border-border pb-8 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void run(); }}>
        <Input aria-label="LinkedIn profile link" placeholder="linkedin.com/in/jane-doe" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" disabled={busy || !url.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Search />} Fetch profile</Button>
      </form>

      {found && (
        <section className="space-y-4 tech-section">
          {found.profile && !found.rejected && (
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                {found.profile.photo_url
                  ? <img src={found.profile.photo_url} alt="" referrerPolicy="no-referrer" className="size-14 rounded-full object-cover" />
                  : <div className="grid size-14 shrink-0 place-items-center rounded-full bg-secondary text-lg font-medium">{initials(found.profile.name)}</div>}
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-medium">{found.profile.name ?? "Unknown name"}</p>
                  {found.profile.headline && <p className="text-sm text-muted-foreground">{found.profile.headline}</p>}
                  <p className="text-sm text-muted-foreground">{[found.profile.current_company, found.profile.location].filter(Boolean).join(" · ")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => run(true, found.url)} disabled={busy} title="Fetch fresh data"><RefreshCw /> Refresh</Button>
              </div>
              <CompletenessBadges profile={found.profile} />
              {found.cached && <p className="text-xs text-muted-foreground">From saved data ({new Date(found.profile.last_refreshed_at).toLocaleDateString()})</p>}
            </div>
          )}
          {found.note && <p className="text-sm">{found.note}</p>}
          {found.rejected && <p className="text-sm">Okay — add the right person's profile yourself instead.</p>}
          {(!found.profile || found.rejected || completeness(found.profile).thin) && (
            <FallbackImport who="target" linkedinUrl={found.url} onParsed={(p) => {
              const { accomplishments: _a, ...rest } = p;
              setFound({ url: found.url, note: null, profile: { ...rest, linkedin_url: found.url, photo_url: null } });
            }} />
          )}
          {found.profile && !found.rejected && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="animate-spin" /> Finding common ground…</> : "Save target"}</Button>
              <Button variant="outline" disabled={saving} onClick={() => setFound({ ...found, rejected: true, note: null })}>Not the right person</Button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-5">
        <h2 className="flex items-center gap-3 text-xl"><span className="h-5 w-1 bg-success" /> Saved</h2>
        {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No targets yet.</p>}
        <ul className="space-y-2">
          {list.data?.map((t) => {
            const p = t.profile as unknown as NormalizedProfile | null;
            return (
              <li key={t.id} className="target-row flex items-center justify-between gap-3 tech-card p-5">
                <div className="min-w-0 space-y-1">
                  <Link to="/targets/$id" params={{ id: t.id }} className="block font-display text-lg font-medium hover:text-primary hover:underline">{p?.name ?? t.linkedin_url}</Link>
                  {p?.headline && <p className="truncate text-sm text-muted-foreground">{p.headline}</p>}
                  <CompletenessBadges profile={p} />
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" asChild><a href={t.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="Open their LinkedIn profile"><ExternalLink /></a></Button>
                  <Button variant="ghost" size="icon" aria-label="Delete target" onClick={() => remove(t.id)}><Trash2 /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function initials(name: string | null) {
  return (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
