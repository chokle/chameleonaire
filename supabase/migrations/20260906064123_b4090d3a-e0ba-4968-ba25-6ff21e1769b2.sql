ALTER TABLE public.creator_videos
  ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_proxy numeric,
  ADD COLUMN IF NOT EXISTS ctr_proxy numeric;

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS engagement_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_proxy numeric,
  ADD COLUMN IF NOT EXISTS ctr_proxy numeric,
  ADD COLUMN IF NOT EXISTS signal_coverage numeric NOT NULL DEFAULT 0;

ALTER TABLE public.blueprints
  ADD COLUMN IF NOT EXISTS signal_coverage numeric NOT NULL DEFAULT 0;