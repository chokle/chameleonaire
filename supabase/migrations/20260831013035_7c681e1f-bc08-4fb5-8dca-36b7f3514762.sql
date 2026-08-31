CREATE TABLE public.youtube_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL UNIQUE REFERENCES public.channels(id) ON DELETE CASCADE,
  youtube_channel_id text,
  youtube_title text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.youtube_accounts TO service_role;
ALTER TABLE public.youtube_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.youtube_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER t_yt_accounts_upd BEFORE UPDATE ON public.youtube_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.oauth_states TO service_role;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.oauth_states FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.generated_videos
  ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS render_error text,
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS youtube_title text;