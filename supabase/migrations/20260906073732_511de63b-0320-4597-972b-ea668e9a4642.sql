DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['blueprints','brands','channels','creator_videos','creators','generated_videos','imported_datasets','performance_snapshots','publish_queue','scans']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'read only for app clients', t);
    EXECUTE format('CREATE POLICY "authenticated read" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;