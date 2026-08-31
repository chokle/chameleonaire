create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.cron_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
-- Secret store for the scheduler: service_role only, no anon/auth grants.
grant all on public.cron_config to service_role;
alter table public.cron_config enable row level security;

create or replace function public.run_publish_tick()
returns void
language plpgsql
security definer
set search_path = public, extensions
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

select cron.unschedule('publish-tick-hourly') where exists (
  select 1 from cron.job where jobname = 'publish-tick-hourly'
);
select cron.schedule('publish-tick-hourly', '17 * * * *', 'select public.run_publish_tick()');