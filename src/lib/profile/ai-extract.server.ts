import type { NormalizedProfile } from "./normalized";
import { emptyProfile } from "./normalized";

const str = { type: ["string", "null"] } as const;
const strArr = { type: "array", items: { type: "string" } } as const;
export const profileSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "headline", "location", "summary", "current_company", "positions", "education", "skills", "certifications", "languages", "accomplishments"],
  properties: {
    name: str, headline: str, location: str, summary: str, current_company: str,
    positions: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "company", "start", "end", "description"],
      properties: { title: str, company: str, start: str, end: str, description: str } } },
    education: { type: "array", items: { type: "object", additionalProperties: false, required: ["school", "degree", "field", "start", "end"],
      properties: { school: str, degree: str, field: str, start: str, end: str } } },
    skills: strArr, certifications: strArr, languages: strArr,
    accomplishments: { ...strArr, description: "Up to 5 concrete, measurable achievements copied or tightly paraphrased from the document" },
  },
};

const PROMPT = `You read a person's CV, LinkedIn "Save to PDF" export, or pasted LinkedIn profile text and extract it into the given schema.
Rules: use ONLY facts written in the input — never guess or invent. Use null for anything not stated.
Dates as written, normalised to "YYYY-MM" or "YYYY" when possible; use "Present" for current roles.
headline: their own title line if present, otherwise null. current_company: employer of their current role, or null.
summary: their profile/summary/About section, max 600 characters.
List positions and education newest first. skills: short skill names, no duplicates, max 40.`;

export type Extracted = NormalizedProfile & { accomplishments: string[] };

export type Part = { type: "input_text"; text: string } | { type: "input_file"; filename: string; file_data: string };

/** Streams a strict-JSON Responses call through Lovable AI and returns the parsed object. */
export async function aiJson<T>(system: string, parts: Part[], name: string, schema: object): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI isn't configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", stream: true, store: false,
      reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name, strict: true, schema } },
      input: [{ role: "system", content: [{ type: "input_text", text: system }] }, { role: "user", content: parts }],
    }),
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    console.error(`[ai:${name}] AI error`, res.status, body.slice(0, 500));
    if (res.status === 429) throw new Error("The AI is busy right now. Please try again in a minute.");
    if (res.status === 402) throw new Error("The free AI allowance is used up for now.");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace right now.");
    throw new Error("The AI couldn't do that. Please try again.");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let ev: { type?: string; delta?: string; response?: { error?: { message?: string } } };
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
      if (ev.type === "response.failed" || ev.type === "error") {
        console.error("[ai] stream failed", ev.response?.error?.message);
        throw new Error("The AI couldn't do that. Please try again.");
      }
    }
  }
  try { return JSON.parse(text) as T; }
  catch { console.error(`[ai:${name}] bad JSON`, text.slice(0, 300)); throw new Error("The AI couldn't do that. Please try again."); }
}

export async function aiExtractProfile(parts: Part[], source: string): Promise<Extracted> {
  const parsed = await aiJson<Omit<Extracted, "source" | "last_refreshed_at" | "photo_url" | "linkedin_url" | "volunteer">>(PROMPT, parts, "profile", profileSchema);
  return { ...emptyProfile(source), ...parsed };
}
