CREATE SCHEMA IF NOT EXISTS private;

GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.owns_channel(_channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = _channel_id AND owner_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() AND auth.role() <> 'service_role' THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END
$$;

CREATE OR REPLACE FUNCTION private.is_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT CASE
    WHEN _user_id IS DISTINCT FROM auth.uid() AND auth.role() <> 'service_role' THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'member'
    )
  END
$$;

DROP POLICY IF EXISTS "Owners can manage their generated videos" ON public.generated_videos;
DROP POLICY IF EXISTS "Owners can manage their publish queue" ON public.publish_queue;
DROP POLICY IF EXISTS "Owners can read their performance snapshots" ON public.performance_snapshots;

CREATE POLICY "Owners can manage their generated videos" ON public.generated_videos
FOR ALL TO authenticated
USING (private.owns_channel(channel_id))
WITH CHECK (private.owns_channel(channel_id));

CREATE POLICY "Owners can manage their publish queue" ON public.publish_queue
FOR ALL TO authenticated
USING (private.owns_channel(channel_id))
WITH CHECK (private.owns_channel(channel_id));

CREATE POLICY "Owners can read their performance snapshots" ON public.performance_snapshots
FOR SELECT TO authenticated
USING (private.owns_channel(channel_id));

DROP POLICY IF EXISTS "approved members read" ON public.blueprints;
DROP POLICY IF EXISTS "approved members read" ON public.brands;
DROP POLICY IF EXISTS "approved members read" ON public.creator_videos;
DROP POLICY IF EXISTS "approved members read" ON public.creators;
DROP POLICY IF EXISTS "approved members read" ON public.imported_datasets;
DROP POLICY IF EXISTS "approved members read" ON public.scans;

CREATE POLICY "approved members read" ON public.blueprints FOR SELECT TO authenticated USING (private.is_member(auth.uid()));
CREATE POLICY "approved members read" ON public.brands FOR SELECT TO authenticated USING (private.is_member(auth.uid()));
CREATE POLICY "approved members read" ON public.creator_videos FOR SELECT TO authenticated USING (private.is_member(auth.uid()));
CREATE POLICY "approved members read" ON public.creators FOR SELECT TO authenticated USING (private.is_member(auth.uid()));
CREATE POLICY "approved members read" ON public.imported_datasets FOR SELECT TO authenticated USING (private.is_member(auth.uid()));
CREATE POLICY "approved members read" ON public.scans FOR SELECT TO authenticated USING (private.is_member(auth.uid()));

DROP FUNCTION IF EXISTS public.owns_channel(uuid);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_member(uuid);