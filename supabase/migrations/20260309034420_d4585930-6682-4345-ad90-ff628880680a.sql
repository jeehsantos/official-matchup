-- Enable RLS on audit_logs
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;

-- Add admin-only SELECT policy for audit_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_logs' AND schemaname = 'public') THEN
    EXECUTE 'CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;

-- Revoke view access from authenticated role and grant to service_role only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'recent_audit_events' AND schemaname = 'public') THEN
    EXECUTE 'REVOKE SELECT ON public.recent_audit_events FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.recent_audit_events TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'rate_limit_violations' AND schemaname = 'public') THEN
    EXECUTE 'REVOKE SELECT ON public.rate_limit_violations FROM authenticated';
    EXECUTE 'GRANT SELECT ON public.rate_limit_violations TO service_role';
  END IF;
END $$;