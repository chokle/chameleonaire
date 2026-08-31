-- Extensions pg_cron/pg_net are Supabase-managed in fixed schemas; keep them.
create or replace function public.run_publish_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select value into v_secret from public.cron_config where key = 'publish_tick_secret';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://id-preview--2a3b00be-e991-4c55-b159-6d9a9e3bd56d.lovable.app/api/public/hooks/publish-tick',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;

revoke execute on function public.run_publish_tick() from public, anon, authenticated;