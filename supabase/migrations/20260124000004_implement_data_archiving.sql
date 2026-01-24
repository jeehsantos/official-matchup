-- Data Retention & Archiving Implementation
-- This migration creates archive tables, functions, and scheduling for data retention

-- ============================================================================
-- ARCHIVE TABLES
-- ============================================================================

-- Sessions Archive
CREATE TABLE IF NOT EXISTS sessions_archive (
    LIKE sessions INCLUDING ALL
) WITH (
    autovacuum_enabled = false,
    fillfactor = 100
);

CREATE INDEX IF NOT EXISTS idx_sessions_archive_user_lookup 
ON sessions_archive(group_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_archive_date 
ON sessions_archive(session_date);

COMMENT ON TABLE sessions_archive IS 'Archive for sessions older than 2 years';

-- Session Players Archive
CREATE TABLE IF NOT EXISTS session_players_archive (
    LIKE session_players INCLUDING ALL
) WITH (
    autovacuum_enabled = false,
    fillfactor = 100
);

CREATE INDEX IF NOT EXISTS idx_session_players_archive_user 
ON session_players_archive(user_id, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_players_archive_session 
ON session_players_archive(session_id);

-- Payments Archive
CREATE TABLE IF NOT EXISTS payments_archive (
    LIKE payments INCLUDING ALL
) WITH (
    autovacuum_enabled = false,
    fillfactor = 100
);

CREATE INDEX IF NOT EXISTS idx_payments_archive_user 
ON payments_archive(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_archive_date 
ON payments_archive(created_at);

CREATE INDEX IF NOT EXISTS idx_payments_archive_stripe 
ON payments_archive(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- Contact Messages Archive
CREATE TABLE IF NOT EXISTS contact_messages_archive (
    LIKE contact_messages INCLUDING ALL
) WITH (
    autovacuum_enabled = false,
    fillfactor = 100
);

CREATE INDEX IF NOT EXISTS idx_contact_archive_date 
ON contact_messages_archive(created_at DESC);

-- ============================================================================
-- ARCHIVING LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS archiving_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    task_name text NOT NULL,
    records_processed bigint NOT NULL,
    execution_time interval NOT NULL,
    status text NOT NULL,
    error_message text,
    created_at timestamptz DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_archiving_logs_date 
ON archiving_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_archiving_logs_task 
ON archiving_logs(task_name, created_at DESC);

COMMENT ON TABLE archiving_logs IS 'Logs for all archiving and cleanup operations';

-- ============================================================================
-- ARCHIVING FUNCTIONS
-- ============================================================================

-- Archive old sessions (older than 2 years)
CREATE OR REPLACE FUNCTION archive_old_sessions()
RETURNS bigint AS $$
DECLARE
    v_cutoff_date date;
    v_count bigint;
BEGIN
    v_cutoff_date := CURRENT_DATE - INTERVAL '2 years';
    
    -- Insert into archive
    INSERT INTO sessions_archive
    SELECT * FROM sessions
    WHERE session_date < v_cutoff_date
      AND id NOT IN (SELECT id FROM sessions_archive);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Delete from active table
    DELETE FROM sessions
    WHERE session_date < v_cutoff_date;
    
    -- Update statistics
    ANALYZE sessions;
    ANALYZE sessions_archive;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION archive_old_sessions IS 'Archives sessions older than 2 years';

-- Archive session players
CREATE OR REPLACE FUNCTION archive_old_session_players()
RETURNS bigint AS $$
DECLARE
    v_count bigint;
BEGIN
    -- Archive players from archived sessions
    INSERT INTO session_players_archive
    SELECT sp.* FROM session_players sp
    INNER JOIN sessions_archive sa ON sa.id = sp.session_id
    WHERE sp.id NOT IN (SELECT id FROM session_players_archive);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Delete from active table
    DELETE FROM session_players sp
    USING sessions_archive sa
    WHERE sp.session_id = sa.id;
    
    ANALYZE session_players;
    ANALYZE session_players_archive;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Archive old payments (older than 7 years)
CREATE OR REPLACE FUNCTION archive_old_payments()
RETURNS bigint AS $$
DECLARE
    v_cutoff_date timestamptz;
    v_count bigint;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '7 years';
    
    INSERT INTO payments_archive
    SELECT * FROM payments
    WHERE created_at < v_cutoff_date
      AND id NOT IN (SELECT id FROM payments_archive);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    DELETE FROM payments
    WHERE created_at < v_cutoff_date;
    
    ANALYZE payments;
    ANALYZE payments_archive;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Archive contact messages (older than 1 year)
CREATE OR REPLACE FUNCTION archive_old_contact_messages()
RETURNS bigint AS $$
DECLARE
    v_cutoff_date timestamptz;
    v_count bigint;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '1 year';
    
    INSERT INTO contact_messages_archive
    SELECT * FROM contact_messages
    WHERE created_at < v_cutoff_date
      AND id NOT IN (SELECT id FROM contact_messages_archive);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    DELETE FROM contact_messages
    WHERE created_at < v_cutoff_date;
    
    ANALYZE contact_messages;
    ANALYZE contact_messages_archive;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Cleanup old availability (older than 6 months, unbooked only)
CREATE OR REPLACE FUNCTION cleanup_old_availability()
RETURNS bigint AS $$
DECLARE
    v_cutoff_date date;
    v_count bigint;
BEGIN
    v_cutoff_date := CURRENT_DATE - INTERVAL '6 months';
    
    DELETE FROM court_availability
    WHERE available_date < v_cutoff_date
      AND is_booked = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    ANALYZE court_availability;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_availability IS 'Deletes unbooked availability older than 6 months';

-- Cleanup old notifications (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS bigint AS $$
DECLARE
    v_cutoff_date timestamptz;
    v_count bigint;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '90 days';
    
    DELETE FROM notifications
    WHERE created_at < v_cutoff_date;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    ANALYZE notifications;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old chat messages (older than 1 year)
CREATE OR REPLACE FUNCTION cleanup_old_chat_messages()
RETURNS bigint AS $$
DECLARE
    v_cutoff_date timestamptz;
    v_count bigint;
    v_conv_count bigint;
BEGIN
    v_cutoff_date := NOW() - INTERVAL '1 year';
    
    -- Delete old messages
    DELETE FROM chat_messages
    WHERE created_at < v_cutoff_date;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Cleanup empty conversations
    DELETE FROM chat_conversations cc
    WHERE NOT EXISTS (
        SELECT 1 FROM chat_messages cm
        WHERE cm.conversation_id = cc.id
    )
    AND cc.created_at < v_cutoff_date;
    
    GET DIAGNOSTICS v_conv_count = ROW_COUNT;
    
    ANALYZE chat_messages;
    ANALYZE chat_conversations;
    
    RETURN v_count + v_conv_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS bigint AS $$
DECLARE
    v_count bigint;
BEGIN
    DELETE FROM group_invitations
    WHERE is_active = false
       OR (expires_at IS NOT NULL AND expires_at < NOW())
       OR (max_uses IS NOT NULL AND use_count >= max_uses);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    ANALYZE group_invitations;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MASTER ARCHIVING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION run_all_archiving_tasks()
RETURNS TABLE(
    task_name text,
    records_processed bigint,
    execution_time interval,
    status text
) AS $$
DECLARE
    v_start_time timestamptz;
    v_end_time timestamptz;
    v_count bigint;
BEGIN
    -- Sessions
    v_start_time := clock_timestamp();
    BEGIN
        v_count := archive_old_sessions();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'archive_sessions'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'archive_sessions'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
    
    -- Session Players
    v_start_time := clock_timestamp();
    BEGIN
        v_count := archive_old_session_players();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'archive_session_players'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'archive_session_players'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
    
    -- Payments
    v_start_time := clock_timestamp();
    BEGIN
        v_count := archive_old_payments();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'archive_payments'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'archive_payments'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
    
    -- Availability Cleanup
    v_start_time := clock_timestamp();
    BEGIN
        v_count := cleanup_old_availability();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'cleanup_availability'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'cleanup_availability'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
    
    -- Notifications Cleanup
    v_start_time := clock_timestamp();
    BEGIN
        v_count := cleanup_old_notifications();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'cleanup_notifications'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'cleanup_notifications'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
    
    -- Chat Cleanup
    v_start_time := clock_timestamp();
    BEGIN
        v_count := cleanup_old_chat_messages();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'cleanup_chat'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'cleanup_chat'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
    
    -- Invitations Cleanup
    v_start_time := clock_timestamp();
    BEGIN
        v_count := cleanup_expired_invitations();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'cleanup_invitations'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'cleanup_invitations'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
    
    -- Contact Messages
    v_start_time := clock_timestamp();
    BEGIN
        v_count := archive_old_contact_messages();
        v_end_time := clock_timestamp();
        RETURN QUERY SELECT 
            'archive_contact_messages'::text, 
            v_count, 
            v_end_time - v_start_time,
            'SUCCESS'::text;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 
            'archive_contact_messages'::text, 
            0::bigint, 
            interval '0',
            'FAILED: ' || SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION run_all_archiving_tasks IS 'Runs all archiving and cleanup tasks with error handling';

-- Function with logging
CREATE OR REPLACE FUNCTION run_all_archiving_tasks_with_logging()
RETURNS void AS $$
DECLARE
    v_result RECORD;
BEGIN
    FOR v_result IN SELECT * FROM run_all_archiving_tasks()
    LOOP
        INSERT INTO archiving_logs (
            task_name,
            records_processed,
            execution_time,
            status,
            error_message
        ) VALUES (
            v_result.task_name,
            v_result.records_processed,
            v_result.execution_time,
            v_result.status,
            CASE WHEN v_result.status LIKE 'FAILED%' 
                 THEN v_result.status 
                 ELSE NULL 
            END
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- USER ARCHIVE ACCESS FUNCTIONS
-- ============================================================================

-- Get user's archived sessions
CREATE OR REPLACE FUNCTION get_user_archived_sessions(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    session_date date,
    sport_type sport_type,
    court_name text,
    venue_name text,
    amount_paid numeric
) SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.session_date,
        g.sport_type,
        c.name as court_name,
        v.name as venue_name,
        COALESCE(p.amount, 0) as amount_paid
    FROM sessions_archive s
    INNER JOIN session_players_archive sp ON sp.session_id = s.id
    INNER JOIN groups g ON g.id = s.group_id
    LEFT JOIN courts c ON c.id = s.court_id
    LEFT JOIN venues v ON v.id = c.venue_id
    LEFT JOIN payments_archive p ON p.session_id = s.id AND p.user_id = p_user_id
    WHERE sp.user_id = p_user_id
    ORDER BY s.session_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Get user's archived payments
CREATE OR REPLACE FUNCTION get_user_archived_payments(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    amount numeric,
    paid_at timestamptz,
    session_date date,
    sport_type sport_type
) SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.amount,
        p.paid_at,
        s.session_date,
        g.sport_type
    FROM payments_archive p
    INNER JOIN sessions_archive s ON s.id = p.session_id
    INNER JOIN groups g ON g.id = s.group_id
    WHERE p.user_id = p_user_id
    ORDER BY p.paid_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GDPR COMPLIANCE - RIGHT TO BE FORGOTTEN
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_data(p_user_id uuid)
RETURNS TABLE(
    table_name text,
    records_affected bigint
) AS $$
DECLARE
    v_count bigint;
BEGIN
    -- Delete from profiles
    DELETE FROM profiles WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'profiles'::text, v_count;
    
    -- Anonymize session_players (keep for statistics)
    UPDATE session_players 
    SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'session_players_anonymized'::text, v_count;
    
    -- Anonymize archived session_players
    UPDATE session_players_archive 
    SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'session_players_archive_anonymized'::text, v_count;
    
    -- Anonymize payments (keep for accounting)
    UPDATE payments 
    SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'payments_anonymized'::text, v_count;
    
    -- Anonymize archived payments
    UPDATE payments_archive 
    SET user_id = '00000000-0000-0000-0000-000000000000'::uuid
    WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'payments_archive_anonymized'::text, v_count;
    
    -- Delete notifications
    DELETE FROM notifications WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'notifications'::text, v_count;
    
    -- Delete chat messages
    DELETE FROM chat_messages WHERE sender_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'chat_messages'::text, v_count;
    
    -- Delete user roles
    DELETE FROM user_roles WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'user_roles'::text, v_count;
    
    -- Delete group memberships
    DELETE FROM group_members WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT 'group_members'::text, v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_user_data IS 'GDPR compliance: Deletes or anonymizes all user data';

-- ============================================================================
-- MONITORING VIEWS
-- ============================================================================

-- View for table sizes
CREATE OR REPLACE VIEW table_sizes AS
SELECT 
    schemaname || '.' || tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size,
    n_live_tup AS row_count,
    n_dead_tup AS dead_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- View for archiving job history
CREATE OR REPLACE VIEW archiving_job_summary AS
SELECT 
    task_name,
    COUNT(*) as run_count,
    SUM(records_processed) as total_records,
    AVG(EXTRACT(EPOCH FROM execution_time)) as avg_seconds,
    MAX(EXTRACT(EPOCH FROM execution_time)) as max_seconds,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status LIKE 'FAILED%') as failure_count,
    MAX(created_at) as last_run
FROM archiving_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY task_name
ORDER BY task_name;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant execute permissions on archiving functions to service role
GRANT EXECUTE ON FUNCTION archive_old_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_session_players() TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_payments() TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_contact_messages() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_availability() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_chat_messages() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO service_role;
GRANT EXECUTE ON FUNCTION run_all_archiving_tasks() TO service_role;
GRANT EXECUTE ON FUNCTION run_all_archiving_tasks_with_logging() TO service_role;

-- Grant execute on user access functions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_archived_sessions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_archived_payments(uuid) TO authenticated;

-- Grant execute on GDPR function to service role only
GRANT EXECUTE ON FUNCTION delete_user_data(uuid) TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sessions_archive IS 'Archive table for sessions older than 2 years';
COMMENT ON TABLE session_players_archive IS 'Archive table for session players from archived sessions';
COMMENT ON TABLE payments_archive IS 'Archive table for payments older than 7 years';
COMMENT ON TABLE contact_messages_archive IS 'Archive table for contact messages older than 1 year';
COMMENT ON TABLE archiving_logs IS 'Audit log for all archiving and cleanup operations';
