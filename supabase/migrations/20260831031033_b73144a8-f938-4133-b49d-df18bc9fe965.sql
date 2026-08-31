-- cron_config: explicit service_role-only policy so the RLS linter is satisfied.
create policy "service role full access"
on public.cron_config
for all
to service_role
using (true)
with check (true);