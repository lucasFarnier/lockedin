import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiExtractProfile, type Extracted } from "@/lib/profile/ai-extract.server";

const MAX_BYTES = 5 * 1024 * 1024;
export type ParsedCv = Extracted;

/** CV or LinkedIn "Save to PDF" → normalized profile (facts only). */
export const parseCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ filename: z.string().min(1).max(200), base64: z.string().min(10), source: z.enum(["cv_upload", "linkedin_pdf"]).default("cv_upload") }).parse(d))
  .handler(async ({ data }): Promise<ParsedCv> => {
    if (data.base64.length * 0.75 > MAX_BYTES) throw new Error("That file is over 5 MB. Please upload a smaller PDF.");
    return aiExtractProfile([
      { type: "input_text", text: "Extract this document." },
      { type: "input_file", filename: data.filename, file_data: `data:application/pdf;base64,${data.base64}` },
    ], data.source);
  });

/** Pasted LinkedIn profile text → normalized profile (facts only). */
export const parseProfileText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().trim().min(40, "Paste a bit more of the profile").max(30000) }).parse(d))
  .handler(async ({ data }): Promise<ParsedCv> =>
    aiExtractProfile([{ type: "input_text", text: `Extract this pasted profile text:\n\n${data.text}` }], "pasted_text"));
