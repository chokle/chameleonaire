GRANT INSERT, UPDATE ON public.blueprints TO authenticated;

CREATE POLICY "approved members update" ON public.blueprints
  FOR UPDATE TO authenticated
  USING (private.is_member(auth.uid()))
  WITH CHECK (private.is_member(auth.uid()));

CREATE POLICY "approved members insert" ON public.blueprints
  FOR INSERT TO authenticated
  WITH CHECK (private.is_member(auth.uid()));