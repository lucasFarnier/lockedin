import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Terminal } from "lucide-react";
import { devProbe } from "@/lib/enrich.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompletenessBadges } from "@/components/profile/completeness";
import type { NormalizedProfile } from "@/lib/profile/normalized";

import { PageHeading } from "@/components/page-heading";

export const Route = createFileRoute("/_authenticated/dev/provider")({
  head: () => ({
    meta: [
      { title: "Provider test (dev) · Lockedin" },
      { name: "description", content: "Developer tool: raw lookup response next to the normalized profile." },
      { property: "og:title", content: "Provider test (dev) · Lockedin" },
      { property: "og:description", content: "Developer tool: raw lookup response next to the normalized profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevProvider,
});

function DevProvider() {
  const probe = useServerFn(devProbe);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Awaited<ReturnType<typeof devProbe>>["outcome"] | null>(null);
  if (!import.meta.env.DEV) return <p className="text-muted-foreground">This page is only available in the preview.</p>;

  async function go() {
    setBusy(true);
    try { const r = await probe({ data: { input } }); setOut(r.outcome); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  const { raw, ...rest } = (out ?? {}) as { raw?: string } & Record<string, unknown>;
  const { profile, ...meta } = rest as { profile?: NormalizedProfile } & Record<string, unknown>;

  return (
    <div className="space-y-6">
      <PageHeading icon={Terminal} title="Provider test"><p>Each run is a real lookup and counts toward the monthly free cap. No caching.</p></PageHeading>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <Input placeholder="email@example.com or linkedin.com/in/…" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" disabled={busy || input.trim().length < 3}>{busy && <Loader2 className="animate-spin" />} Run</Button>
      </form>
      {out && (
        <>
          <pre className="rounded-lg bg-muted p-3 text-xs">{JSON.stringify(meta, null, 2)}</pre>
          {profile && <CompletenessBadges profile={profile} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <div><h2 className="mb-2 font-medium">Raw provider response</h2><pre className="max-h-[70vh] overflow-auto rounded-lg bg-muted p-3 text-xs">{raw ? JSON.stringify(JSON.parse(raw), null, 2) : "null"}</pre></div>
            <div><h2 className="mb-2 font-medium">Normalized</h2><pre className="max-h-[70vh] overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(profile ?? null, null, 2)}</pre></div>
          </div>
        </>
      )}
    </div>
  );
}
