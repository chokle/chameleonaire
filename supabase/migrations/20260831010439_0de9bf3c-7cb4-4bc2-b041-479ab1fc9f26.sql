-- helper
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.imported_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_type text NOT NULL DEFAULT 'csv',
  row_count integer NOT NULL DEFAULT 0,
  notes text,
  raw jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niche text NOT NULL,
  bracket_min numeric NOT NULL DEFAULT 0,
  bracket_max numeric,
  source text NOT NULL DEFAULT 'model',
  status text NOT NULL DEFAULT 'pending',
  error text,
  results_count integer NOT NULL DEFAULT 0,
  is_persistent boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES public.scans(id) ON DELETE SET NULL,
  channel_name text NOT NULL,
  handle text,
  channel_url text,
  niche text NOT NULL DEFAULT 'general',
  subscribers bigint NOT NULL DEFAULT 0,
  avg_views bigint NOT NULL DEFAULT 0,
  uploads_per_month numeric NOT NULL DEFAULT 0,
  rpm_low numeric NOT NULL DEFAULT 2,
  rpm_high numeric NOT NULL DEFAULT 8,
  est_profit_per_video numeric NOT NULL DEFAULT 0,
  est_profit_low numeric NOT NULL DEFAULT 0,
  est_profit_high numeric NOT NULL DEFAULT 0,
  est_monthly numeric NOT NULL DEFAULT 0,
  view_velocity numeric NOT NULL DEFAULT 0,
  consistency_score numeric NOT NULL DEFAULT 0,
  format text,
  data_source text NOT NULL DEFAULT 'model',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  title text NOT NULL,
  video_url text,
  thumbnail_desc text,
  views bigint NOT NULL DEFAULT 0,
  duration_seconds integer,
  published_at timestamptz,
  est_profit numeric NOT NULL DEFAULT 0,
  hook text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  niche text NOT NULL DEFAULT 'general',
  source_creator_ids uuid[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0,
  deployable boolean NOT NULL DEFAULT false,
  gap_notes text,
  strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  win_rate numeric NOT NULL DEFAULT 0,
  generation integer NOT NULL DEFAULT 1,
  parent_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  voice text,
  subject text,
  palette text,
  audience text,
  banned_topics text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  blueprint_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  divergence numeric NOT NULL DEFAULT 25,
  uploads_per_week numeric NOT NULL DEFAULT 3,
  auto_publish boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  youtube_channel_id text,
  connected boolean NOT NULL DEFAULT false,
  est_monthly numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.generated_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  title text NOT NULL,
  hook text,
  script text,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  thumbnail_prompt text,
  thumbnail_url text,
  video_url text,
  concept text,
  divergence_applied numeric NOT NULL DEFAULT 25,
  status text NOT NULL DEFAULT 'draft',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.publish_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_video_id uuid NOT NULL REFERENCES public.generated_videos(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'scheduled',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_video_id uuid REFERENCES public.generated_videos(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  blueprint_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
  views bigint NOT NULL DEFAULT 0,
  est_revenue numeric NOT NULL DEFAULT 0,
  ctr numeric,
  retention numeric,
  outcome text NOT NULL DEFAULT 'pending',
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.job_state (
  id text PRIMARY KEY,
  paused boolean NOT NULL DEFAULT false,
  pause_reason text,
  lease_until timestamptz,
  last_run_at timestamptz,
  runs integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- grants (single personal workspace, no login)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_datasets, public.scans, public.creators,
  public.creator_videos, public.blueprints, public.brands, public.channels, public.generated_videos,
  public.publish_queue, public.performance_snapshots, public.job_state TO anon, authenticated;
GRANT ALL ON public.imported_datasets, public.scans, public.creators, public.creator_videos,
  public.blueprints, public.brands, public.channels, public.generated_videos, public.publish_queue,
  public.performance_snapshots, public.job_state TO service_role;

ALTER TABLE public.imported_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open access" ON public.imported_datasets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.scans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.creators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.creator_videos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.blueprints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.brands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.generated_videos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.publish_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.performance_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open access" ON public.job_state FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER t_scans_upd BEFORE UPDATE ON public.scans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_creators_upd BEFORE UPDATE ON public.creators FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_blueprints_upd BEFORE UPDATE ON public.blueprints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_brands_upd BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_channels_upd BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_genvid_upd BEFORE UPDATE ON public.generated_videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_queue_upd BEFORE UPDATE ON public.publish_queue FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_creators_scan ON public.creators(scan_id);
CREATE INDEX idx_creators_profit ON public.creators(est_profit_per_video DESC);
CREATE INDEX idx_creator_videos_creator ON public.creator_videos(creator_id);
CREATE INDEX idx_genvid_channel ON public.generated_videos(channel_id);
CREATE INDEX idx_queue_status ON public.publish_queue(status, scheduled_for);

INSERT INTO public.job_state (id) VALUES ('rescan'), ('generation'), ('publish');
