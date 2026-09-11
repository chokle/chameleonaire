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
      WHERE user_id = _user_id AND role IN ('admin','member')
    )
  END
$$;