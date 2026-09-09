ALTER TABLE public.performance_snapshots
  ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watch_time_minutes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS youtube_video_id text;

CREATE INDEX IF NOT EXISTS performance_snapshots_video_captured_idx
  ON public.performance_snapshots (generated_video_id, captured_at DESC);