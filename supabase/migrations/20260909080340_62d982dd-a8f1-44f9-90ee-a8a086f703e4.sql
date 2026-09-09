revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.run_publish_tick() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.is_member(uuid) to authenticated, service_role;
grant execute on function public.run_publish_tick() to service_role;