ALTER TABLE public.provider_calls ADD COLUMN likelihood int;
ALTER TABLE public.targets ADD COLUMN analysis jsonb, ADD COLUMN analysis_at timestamptz;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  channel text NOT NULL,
  goal text NOT NULL,
  tone text NOT NULL,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_text text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_target ON public.messages (target_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages update" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = user_id);