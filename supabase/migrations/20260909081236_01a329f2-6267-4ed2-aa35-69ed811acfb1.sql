ALTER FUNCTION public.update_updated_at_column() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated, anon;