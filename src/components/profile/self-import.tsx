import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { enrichSelf } from "@/lib/enrich.functions";
import type { NormalizedProfile } from "@/lib/profile/normalized";
import type { ParsedCv } from "@/lib/cv.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CompletenessBadges } from "./completeness";
import { FallbackImport } from "./fallback-import";

type Step = "searching" | "match" | "url" | "fallback";

/** "Is this you?" self-import: email lookup → own LinkedIn URL → PDF / pasted text. */
export function SelfImport({ autoStart, photo, onConfirm, onDone }: {
  autoStart: boolean; photo: string | null;
  onConfirm: (p: NormalizedProfile | ParsedCv) => Promise<void>; onDone: () => void;
}) {
  const run = useServerFn(enrichSelf);
  const [step, setStep] = useState<Step>(autoStart ? "searching" : "url");
  const [match, setMatch] = useState<NormalizedProfile | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const started = useRef(false);

  async function lookup(mode: "email" | "url") {
    setBusy(true); setNote(null);
    try {
      const r = await run({ data: mode === "url" ? { mode, url } : { mode } });
      if (r.status === "ok") { setMatch(r.profile); setStep("match"); return; }
      if (mode === "email") { setStep("url"); setNote(r.status === "not_found" ? "We couldn't find you by email." : r.message); }
      else { setStep("fallback"); setNote(r.status === "not_found" ? "We couldn't find that profile." : r.message); }
    } catch (e) {
      if (mode === "url") toast.error(e instanceof Error ? e.message : "Lookup failed"); else setStep("url");
    } finally { setBusy(false); }
  }

  useEffect(() => { if (autoStart && !started.current) { started.current = true; void lookup("email"); } }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="space-y-4 tech-section">
      <h2 className="flex items-center gap-2 text-xl"><Sparkles className="size-5 text-primary" /> Import your profile</h2>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}

      {step === "searching" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Looking for your profile…</p>}

      {step === "match" && match && (
        <div className="space-y-4">
          <p className="font-medium">Is this you?</p>
          <div className="flex items-center gap-4 border-l-2 border-primary bg-muted p-4">
            {(match.photo_url ?? photo)
              ? <img src={match.photo_url ?? photo ?? undefined} alt="" referrerPolicy="no-referrer" className="size-14 rounded-full object-cover" />
              : <div className="grid size-14 place-items-center rounded-full bg-secondary text-xl">{(match.name ?? "?")[0]}</div>}
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium">{match.name ?? "Unknown name"}</p>
              {match.headline && <p className="truncate text-sm text-muted-foreground">{match.headline}</p>}
              {match.current_company && <p className="truncate text-sm text-muted-foreground">Currently at {match.current_company}</p>}
              <CompletenessBadges profile={match} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(match); onDone(); } finally { setBusy(false); } }}>Yes, that's me</Button>
            <Button variant="outline" disabled={busy} onClick={() => { setMatch(null); setStep(match.linkedin_url ? "fallback" : "url"); setNote(null); }}>Not me</Button>
          </div>
        </div>
      )}

      {step === "url" && (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void lookup("url"); }}>
          <Input aria-label="Paste your LinkedIn profile URL" placeholder="Paste your LinkedIn profile URL (linkedin.com/in/…)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button type="submit" disabled={busy || !url.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Search />} Find me</Button>
          <Button type="button" variant="ghost" onClick={() => setStep("fallback")}>Skip</Button>
        </form>
      )}

      {step === "fallback" && <FallbackImport who="self" linkedinUrl={url.trim() ? url.trim() : null} onParsed={async (p) => { await onConfirm(p); onDone(); }} />}

      <p className="text-xs text-muted-foreground">Optional: <span className="font-medium">Import full history & connections</span> from your LinkedIn data export — coming soon, never required.</p>
    </section>
  );
}
