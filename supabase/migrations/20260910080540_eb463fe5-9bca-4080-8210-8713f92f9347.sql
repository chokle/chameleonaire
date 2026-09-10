ALTER TABLE public.channels ADD COLUMN owner_id uuid REFERENCES auth.users(id);

UPDATE public.channels SET owner_id = '04e957ee-f98e-4365-905f-2f0734d8be0d' WHERE owner_id IS NULL;

ALTER TABLE public.channels ALTER COLUMN owner_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.owns_channel(_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = _channel_id AND owner_id = auth.uid()
  )
$$;

DROP POLICY IF EXISTS "approved members read" ON public.channels;
DROP POLICY IF EXISTS "approved members read" ON public.generated_videos;
DROP POLICY IF EXISTS "approved members read" ON public.publish_queue;
DROP POLICY IF EXISTS "approved members read" ON public.performance_snapshots;

CREATE POLICY "Owners can manage their channels" ON public.channels
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can manage their generated videos" ON public.generated_videos
FOR ALL TO authenticated
USING (public.owns_channel(channel_id))
WITH CHECK (public.owns_channel(channel_id));

CREATE POLICY "Owners can manage their publish queue" ON public.publish_queue
FOR ALL TO authenticated
USING (public.owns_channel(channel_id))
WITH CHECK (public.owns_channel(channel_id));

CREATE POLICY "Owners can read their performance snapshots" ON public.performance_snapshots
FOR SELECT TO authenticated
USING (public.owns_channel(channel_id));

CREATE TABLE public.video_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    title text NOT NULL DEFAULT '',
    hook text NOT NULL DEFAULT '',
    script text NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    tags text[] NOT NULL DEFAULT '{}',
    visual_style text NOT NULL DEFAULT '',
    palette text NOT NULL DEFAULT '',
    pacing text NOT NULL DEFAULT '',
    shot_notes text NOT NULL DEFAULT '',
    thumbnail_prompt text NOT NULL DEFAULT '',
    duration_target integer NOT NULL DEFAULT 30,
    blueprint_id uuid REFERENCES public.blueprints(id) ON DELETE SET NULL,
    brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_templates TO authenticated;
GRANT ALL ON public.video_templates TO service_role;

ALTER TABLE public.video_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their video templates" ON public.video_templates
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER t_video_templates_upd BEFORE UPDATE ON public.video_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();