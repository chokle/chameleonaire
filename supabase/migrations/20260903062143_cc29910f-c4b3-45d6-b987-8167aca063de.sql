-- Application data becomes read-only for the browser; all writes go through
-- server handlers using the service role.

do $$
declare t text;
begin
  foreach t in array array[
    'blueprints','creators','creator_videos','brands','channels','generated_videos',
    'publish_queue','scans','imported_datasets','performance_snapshots','job_state'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'open access', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "read only for app clients" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "service role full access" on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end $$;

-- Job scheduling state and performance metrics are not client-readable at all.
drop policy if exists "read only for app clients" on public.job_state;
revoke select on public.job_state from anon, authenticated;

-- Private render storage: explicit deny for public roles, service role only.
drop policy if exists "renders service role read" on storage.objects;
drop policy if exists "renders service role write" on storage.objects;
drop policy if exists "renders service role update" on storage.objects;
drop policy if exists "renders service role delete" on storage.objects;

create policy "renders service role read" on storage.objects
  for select to service_role using (bucket_id = 'renders');
create policy "renders service role write" on storage.objects
  for insert to service_role with check (bucket_id = 'renders');
create policy "renders service role update" on storage.objects
  for update to service_role using (bucket_id = 'renders') with check (bucket_id = 'renders');
create policy "renders service role delete" on storage.objects
  for delete to service_role using (bucket_id = 'renders');