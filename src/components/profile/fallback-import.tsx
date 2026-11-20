import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { parseCv, parseProfileText, type ParsedCv } from "@/lib/cv.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export async function fileToBase64(file: File) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** "Upload their LinkedIn PDF" / "Paste profile text" — both parsed by AI into the normalized profile. */
export function FallbackImport({ linkedinUrl, who, onParsed }: { linkedinUrl?: string | null; who: "self" | "target"; onParsed: (p: ParsedCv) => void }) {
  const [busy, setBusy] = useState<"pdf" | "text" | null>(null);
  const [text, setText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsePdf = useServerFn(parseCv);
  const parseText = useServerFn(parseProfileText);

  async function onFile(file: File) {
    if (file.type !== "application/pdf") { toast.error("Please choose a PDF file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("That file is over 5 MB."); return; }
    setBusy("pdf");
    try { onParsed(await parsePdf({ data: { filename: file.name, base64: await fileToBase64(file), source: "linkedin_pdf" } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't read that PDF"); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function onText() {
    setBusy("text");
    try { onParsed(await parseText({ data: { text } })); setText(""); setShowPaste(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't read that text"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-3 border-t border-dashed border-primary/40 py-5 text-sm">
      <p className="flex items-center gap-2 font-medium"><FileText className="size-4 text-primary" />
        {who === "self" ? "Upload your LinkedIn PDF" : "Add their profile yourself"}</p>
      <p className="text-muted-foreground">
        On LinkedIn, open {who === "self" ? "your" : "their"} profile → <b>Resources</b> (or <b>More</b>) → <b>Save to PDF</b>, then upload it here. Or copy the profile page text and paste it.
      </p>
      <div className="flex flex-wrap gap-2">
        {linkedinUrl && <Button variant="outline" size="sm" asChild><a href={linkedinUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Open {who === "self" ? "your" : "their"} LinkedIn profile</a></Button>}
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          {busy === "pdf" ? <><Loader2 className="animate-spin" /> Reading…</> : <><Upload /> Upload LinkedIn PDF</>}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowPaste((v) => !v)} disabled={!!busy}>Paste profile text</Button>
      </div>
      {showPaste && (
        <div className="space-y-2">
          <Textarea rows={6} placeholder="Paste the profile text here (About, Experience, Education, Skills…)" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" onClick={onText} disabled={busy === "text" || text.trim().length < 40}>
            {busy === "text" ? <><Loader2 className="animate-spin" /> Reading…</> : "Read this text"}
          </Button>
        </div>
      )}
    </div>
  );
}
