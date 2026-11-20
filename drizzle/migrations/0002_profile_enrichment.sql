CREATE TABLE public.enriched_profiles_cache (
  cache_key text PRIMARY KEY,
  provider text NOT NULL,
  profile jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.enriched_profiles_cache TO service_role;
ALTER TABLE public.enriched_profiles_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.provider_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  provider text NOT NULL,
  kind text NOT NULL,
  query text NOT NULL,
  outcome text NOT NULL,
  http_status int,
  counted boolean NOT NULL DEFAULT true,
  raw_response text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_calls_user_month ON public.provider_calls (user_id, created_at);
GRANT ALL ON public.provider_calls TO service_role;
ALTER TABLE public.provider_calls ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  linkedin_url text NOT NULL,
  profile jsonb,
  notes text,
  priority int NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.targets TO authenticated;
GRANT ALL ON public.targets TO service_role;
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own targets select" ON public.targets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own targets insert" ON public.targets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own targets update" ON public.targets FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own targets delete" ON public.targets FOR DELETE TO authenticated USING (auth.uid() = user_id);