-- Rate Limiting Implementation
-- Protects against brute force attacks and API abuse

-- ============================================================================
-- RATE LIMITING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier text NOT NULL, -- IP address or user ID
    endpoint text NOT NULL,
    attempt_count integer DEFAULT 1,
    window_start timestamptz DEFAULT NOW() NOT NULL,
    blocked_until timestamptz,
    created_at timestamptz DEFAULT NOW() NOT NULL,
    updated_at timestamptz DEFAULT NOW() NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint 
ON rate_limits(identifier, endpoint, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked 
ON rate_limits(blocked_until) 
WHERE blocked_until IS NOT NULL AND blocked_until > NOW();

-- Cleanup old entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup 
ON rate_limits(created_at) 
WHERE created_at < NOW() - INTERVAL '1 hour';

COMMENT ON TABLE rate_limits IS 'Tracks API rate limiting to prevent abuse';

-- ============================================================================
-- RATE LIMITING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier text,
    p_endpoint text,
    p_max_attempts integer DEFAULT 5,
    p_window_minutes integer DEFAULT 15,
    p_block_minutes integer DEFAULT 60
)
RETURNS TABLE(
    allowed boolean,
    attempts_remaining integer,
    retry_after timestamptz
) AS $$
DECLARE
    v_window_start timestamptz;
    v_current_attempts integer;
    v_blocked_until timestamptz;
    v_rate_limit RECORD;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::interval;
    
    -- Check if currently blocked
    SELECT blocked_until INTO v_blocked_until
    FROM rate_limits
    WHERE identifier = p_identifier
      AND endpoint = p_endpoint
      AND blocked_until IS NOT NULL
      AND blocked_until > NOW()
    ORDER BY blocked_until DESC
    LIMIT 1;
    
    IF v_blocked_until IS NOT NULL THEN
        RETURN QUERY SELECT 
            false,
            0,
            v_blocked_until;
        RETURN;
    END IF;
    
    -- Get or create rate limit record
    SELECT * INTO v_rate_limit
    FROM rate_limits
    WHERE identifier = p_identifier
      AND endpoint = p_endpoint
      AND window_start > v_window_start
    ORDER BY window_start DESC
    LIMIT 1;
    
    IF v_rate_limit IS NULL THEN
        -- First attempt in this window
        INSERT INTO rate_limits (identifier, endpoint, attempt_count, window_start)
        VALUES (p_identifier, p_endpoint, 1, NOW())
        RETURNING * INTO v_rate_limit;
        
        RETURN QUERY SELECT 
            true,
            p_max_attempts - 1,
            NULL::timestamptz;
        RETURN;
    END IF;
    
    v_current_attempts := v_rate_limit.attempt_count;
    
    IF v_current_attempts >= p_max_attempts THEN
        -- Block the identifier
        v_blocked_until := NOW() + (p_block_minutes || ' minutes')::interval;
        
        UPDATE rate_limits
        SET blocked_until = v_blocked_until,
            updated_at = NOW()
        WHERE id = v_rate_limit.id;
        
        RETURN QUERY SELECT 
            false,
            0,
            v_blocked_until;
        RETURN;
    END IF;
    
    -- Increment attempt count
    UPDATE rate_limits
    SET attempt_count = attempt_count + 1,
        updated_at = NOW()
    WHERE id = v_rate_limit.id;
    
    RETURN QUERY SELECT 
        true,
        p_max_attempts - (v_current_attempts + 1),
        NULL::timestamptz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_rate_limit IS 'Checks if request is within rate limits';

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS bigint AS $$
DECLARE
    v_count bigint;
BEGIN
    -- Delete rate limit records older than 1 hour
    DELETE FROM rate_limits
    WHERE created_at < NOW() - INTERVAL '1 hour'
      AND (blocked_until IS NULL OR blocked_until < NOW());
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    ANALYZE rate_limits;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RATE LIMIT PRESETS
-- ============================================================================

-- Authentication endpoints (stricter)
CREATE OR REPLACE FUNCTION check_auth_rate_limit(p_identifier text)
RETURNS TABLE(allowed boolean, attempts_remaining integer, retry_after timestamptz) AS $$
BEGIN
    RETURN QUERY SELECT * FROM check_rate_limit(
        p_identifier,
        'auth',
        5,  -- 5 attempts
        15, -- per 15 minutes
        60  -- block for 60 minutes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- API endpoints (moderate)
CREATE OR REPLACE FUNCTION check_api_rate_limit(p_identifier text, p_endpoint text)
RETURNS TABLE(allowed boolean, attempts_remaining integer, retry_after timestamptz) AS $$
BEGIN
    RETURN QUERY SELECT * FROM check_rate_limit(
        p_identifier,
        p_endpoint,
        100, -- 100 attempts
        1,   -- per 1 minute
        5    -- block for 5 minutes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Payment endpoints (very strict)
CREATE OR REPLACE FUNCTION check_payment_rate_limit(p_identifier text)
RETURNS TABLE(allowed boolean, attempts_remaining integer, retry_after timestamptz) AS $$
BEGIN
    RETURN QUERY SELECT * FROM check_rate_limit(
        p_identifier,
        'payment',
        3,   -- 3 attempts
        10,  -- per 10 minutes
        120  -- block for 2 hours
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id uuid,
    ip_address inet,
    user_agent text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT NOW() NOT NULL
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource 
ON audit_logs(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created 
ON audit_logs(created_at DESC);

-- Partition by month for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_month 
ON audit_logs(date_trunc('month', created_at));

COMMENT ON TABLE audit_logs IS 'Audit trail for security-sensitive operations';

-- ============================================================================
-- AUDIT LOGGING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id uuid,
    p_action text,
    p_resource_type text DEFAULT NULL,
    p_resource_id uuid DEFAULT NULL,
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO audit_logs (
        user_id,
        action,
        resource_type,
        resource_id,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_user_id,
        p_action,
        p_resource_type,
        p_resource_id,
        p_ip_address,
        p_user_agent,
        p_metadata
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_audit_event IS 'Logs security-sensitive events for audit trail';

-- ============================================================================
-- AUTOMATIC AUDIT TRIGGERS
-- ============================================================================

-- Trigger for user role changes
CREATE OR REPLACE FUNCTION audit_user_role_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit_event(
            NEW.user_id,
            'user_role_added',
            'user_roles',
            NEW.id,
            NULL,
            NULL,
            jsonb_build_object('role', NEW.role)
        );
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_audit_event(
            OLD.user_id,
            'user_role_removed',
            'user_roles',
            OLD.id,
            NULL,
            NULL,
            jsonb_build_object('role', OLD.role)
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_user_roles
AFTER INSERT OR DELETE ON user_roles
FOR EACH ROW EXECUTE FUNCTION audit_user_role_changes();

-- Trigger for payment events
CREATE OR REPLACE FUNCTION audit_payment_events()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_audit_event(
            NEW.user_id,
            'payment_created',
            'payments',
            NEW.id,
            NULL,
            NULL,
            jsonb_build_object(
                'amount', NEW.amount,
                'status', NEW.status,
                'session_id', NEW.session_id
            )
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        PERFORM log_audit_event(
            NEW.user_id,
            'payment_status_changed',
            'payments',
            NEW.id,
            NULL,
            NULL,
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'amount', NEW.amount
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_payments
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION audit_payment_events();

-- ============================================================================
-- CLEANUP JOBS
-- ============================================================================

-- Schedule cleanup of old rate limits (run every hour)
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_old_rate_limits()');

-- Archive old audit logs (keep 1 year, then move to archive)
CREATE OR REPLACE FUNCTION archive_old_audit_logs()
RETURNS bigint AS $$
DECLARE
    v_count bigint;
    v_cutoff_date timestamptz;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '1 year';
    
    -- In production, you'd move these to an archive table
    -- For now, we'll just delete very old logs (2+ years)
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '2 years';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    ANALYZE audit_logs;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for rate limit violations
CREATE OR REPLACE VIEW rate_limit_violations AS
SELECT 
    identifier,
    endpoint,
    COUNT(*) as violation_count,
    MAX(blocked_until) as last_blocked_until,
    MAX(attempt_count) as max_attempts,
    MAX(created_at) as last_violation
FROM rate_limits
WHERE blocked_until IS NOT NULL
GROUP BY identifier, endpoint
ORDER BY violation_count DESC;

-- View for recent audit events
CREATE OR REPLACE VIEW recent_audit_events AS
SELECT 
    al.*,
    p.full_name as user_name,
    p.email as user_email
FROM audit_logs al
LEFT JOIN profiles p ON p.user_id = al.user_id
WHERE al.created_at > NOW() - INTERVAL '7 days'
ORDER BY al.created_at DESC;

-- View for suspicious activity
CREATE OR REPLACE VIEW suspicious_activity AS
SELECT 
    user_id,
    action,
    COUNT(*) as event_count,
    array_agg(DISTINCT ip_address::text) as ip_addresses,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, action
HAVING COUNT(*) > 10  -- More than 10 of same action in 1 hour
ORDER BY event_count DESC;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_rate_limit(text, text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION check_auth_rate_limit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_api_rate_limit(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_payment_rate_limit(text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(uuid, text, text, uuid, inet, text, jsonb) TO authenticated;

GRANT SELECT ON rate_limit_violations TO authenticated;
GRANT SELECT ON recent_audit_events TO authenticated;
GRANT SELECT ON suspicious_activity TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE rate_limits IS 'Rate limiting to prevent brute force and API abuse';
COMMENT ON TABLE audit_logs IS 'Security audit trail for compliance and forensics';
COMMENT ON VIEW rate_limit_violations IS 'Shows identifiers that have been rate limited';
COMMENT ON VIEW recent_audit_events IS 'Recent security-sensitive events';
COMMENT ON VIEW suspicious_activity IS 'Detects potential security threats';
