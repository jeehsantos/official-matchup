-- Performance Optimization: Create Materialized Views and Helper Views
-- This migration creates views to eliminate N+1 queries

-- ============================================================================
-- MATERIALIZED VIEW: Group Member Counts
-- ============================================================================
-- Eliminates N+1 queries in Groups.tsx where member counts are fetched one by one

CREATE MATERIALIZED VIEW IF NOT EXISTS group_member_counts AS
SELECT 
  g.id as group_id,
  COUNT(DISTINCT gm.user_id) + 1 as member_count  -- +1 for organizer
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
WHERE g.is_active = true
GROUP BY g.id;

-- Create unique index for fast lookups and concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_member_counts_group_id 
ON group_member_counts(group_id);

-- Add comment
COMMENT ON MATERIALIZED VIEW group_member_counts IS 
'Cached member counts for groups to avoid N+1 queries. Refreshed on group_members changes.';

-- ============================================================================
-- TRIGGER: Auto-refresh group_member_counts
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_group_member_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the materialized view concurrently (non-blocking)
  REFRESH MATERIALIZED VIEW CONCURRENTLY group_member_counts;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT
CREATE TRIGGER trigger_refresh_group_counts_insert
AFTER INSERT ON group_members
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_group_member_counts();

-- Trigger on DELETE
CREATE TRIGGER trigger_refresh_group_counts_delete
AFTER DELETE ON group_members
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_group_member_counts();

-- ============================================================================
-- VIEW: Session Player Counts
-- ============================================================================
-- Eliminates N+1 queries when fetching session player counts

CREATE OR REPLACE VIEW session_player_counts AS
SELECT 
  session_id,
  COUNT(*) as total_players,
  COUNT(*) FILTER (WHERE is_confirmed = true) as confirmed_players,
  COUNT(*) FILTER (WHERE is_from_rescue = true) as rescue_players
FROM session_players
GROUP BY session_id;

-- Add comment
COMMENT ON VIEW session_player_counts IS 
'Real-time player counts for sessions. Use JOIN instead of separate queries.';

-- ============================================================================
-- VIEW: Groups with Member Counts
-- ============================================================================
-- Combines groups with their member counts for efficient querying

CREATE OR REPLACE VIEW groups_with_counts AS
SELECT 
  g.*,
  COALESCE(gmc.member_count, 1) as member_count
FROM groups g
LEFT JOIN group_member_counts gmc ON gmc.group_id = g.id
WHERE g.is_active = true;

-- Add comment
COMMENT ON VIEW groups_with_counts IS 
'Groups with pre-calculated member counts. Use this instead of separate count queries.';

-- ============================================================================
-- VIEW: Sessions with Player Counts
-- ============================================================================
-- Combines sessions with their player counts for efficient querying

CREATE OR REPLACE VIEW sessions_with_counts AS
SELECT 
  s.*,
  COALESCE(spc.total_players, 0) as player_count,
  COALESCE(spc.confirmed_players, 0) as confirmed_count,
  COALESCE(spc.rescue_players, 0) as rescue_count
FROM sessions s
LEFT JOIN session_player_counts spc ON spc.session_id = s.id
WHERE s.is_cancelled = false;

-- Add comment
COMMENT ON VIEW sessions_with_counts IS 
'Sessions with pre-calculated player counts. Use this instead of separate count queries.';

-- ============================================================================
-- VIEW: Court Availability Summary
-- ============================================================================
-- Provides quick stats on court availability

CREATE OR REPLACE VIEW court_availability_summary AS
SELECT 
  court_id,
  available_date,
  COUNT(*) as total_slots,
  COUNT(*) FILTER (WHERE is_booked = false) as available_slots,
  COUNT(*) FILTER (WHERE is_booked = true) as booked_slots,
  COUNT(*) FILTER (WHERE is_booked = true AND payment_status = 'pending') as pending_payment_slots,
  COUNT(*) FILTER (WHERE is_booked = true AND payment_status = 'completed') as paid_slots
FROM court_availability
GROUP BY court_id, available_date;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_court_availability_summary 
ON court_availability(court_id, available_date);

-- Add comment
COMMENT ON VIEW court_availability_summary IS 
'Daily availability summary per court. Useful for calendar views.';

-- ============================================================================
-- VIEW: User Session History
-- ============================================================================
-- Efficiently get all sessions a user has participated in

CREATE OR REPLACE VIEW user_session_history AS
SELECT 
  sp.user_id,
  s.*,
  sp.is_confirmed,
  sp.is_from_rescue,
  sp.joined_at,
  g.name as group_name,
  g.sport_type,
  c.name as court_name,
  v.name as venue_name,
  v.city as venue_city
FROM session_players sp
JOIN sessions s ON s.id = sp.session_id
JOIN groups g ON g.id = s.group_id
LEFT JOIN courts c ON c.id = s.court_id
LEFT JOIN venues v ON v.id = c.venue_id
WHERE s.is_cancelled = false;

-- Add comment
COMMENT ON VIEW user_session_history IS 
'Complete session history for users with all related data in one query.';

-- ============================================================================
-- VIEW: User Groups with Details
-- ============================================================================
-- Efficiently get all groups a user belongs to with full details

CREATE OR REPLACE VIEW user_groups_with_details AS
SELECT 
  gm.user_id,
  g.*,
  gm.is_admin,
  gm.joined_at,
  COALESCE(gmc.member_count, 1) as member_count,
  p.full_name as organizer_name
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
LEFT JOIN group_member_counts gmc ON gmc.group_id = g.id
LEFT JOIN profiles p ON p.user_id = g.organizer_id
WHERE g.is_active = true

UNION

-- Include groups where user is the organizer
SELECT 
  g.organizer_id as user_id,
  g.*,
  true as is_admin,
  g.created_at as joined_at,
  COALESCE(gmc.member_count, 1) as member_count,
  p.full_name as organizer_name
FROM groups g
LEFT JOIN group_member_counts gmc ON gmc.group_id = g.id
LEFT JOIN profiles p ON p.user_id = g.organizer_id
WHERE g.is_active = true;

-- Add comment
COMMENT ON VIEW user_groups_with_details IS 
'All groups a user belongs to (as member or organizer) with full details.';

-- ============================================================================
-- VIEW: Upcoming Sessions with Details
-- ============================================================================
-- Get upcoming sessions with all related data in one query

CREATE OR REPLACE VIEW upcoming_sessions_with_details AS
SELECT 
  s.*,
  g.name as group_name,
  g.sport_type,
  g.organizer_id,
  c.name as court_name,
  c.photo_url as court_photo,
  v.name as venue_name,
  v.address as venue_address,
  v.city as venue_city,
  COALESCE(spc.total_players, 0) as player_count,
  COALESCE(spc.confirmed_players, 0) as confirmed_count
FROM sessions s
JOIN groups g ON g.id = s.group_id
LEFT JOIN courts c ON c.id = s.court_id
LEFT JOIN venues v ON v.id = c.venue_id
LEFT JOIN session_player_counts spc ON spc.session_id = s.id
WHERE s.is_cancelled = false
  AND s.session_date >= CURRENT_DATE
ORDER BY s.session_date ASC, s.start_time ASC;

-- Add comment
COMMENT ON VIEW upcoming_sessions_with_details IS 
'All upcoming sessions with complete details. Optimized for game listing pages.';

-- ============================================================================
-- VIEW: Payment Summary by User
-- ============================================================================
-- Get payment statistics per user

CREATE OR REPLACE VIEW user_payment_summary AS
SELECT 
  user_id,
  COUNT(*) as total_payments,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_payments,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
  SUM(amount) FILTER (WHERE status = 'completed') as total_paid,
  SUM(amount) FILTER (WHERE status = 'pending') as total_pending
FROM payments
GROUP BY user_id;

-- Add comment
COMMENT ON VIEW user_payment_summary IS 
'Payment statistics per user. Useful for user profiles and dashboards.';

-- ============================================================================
-- FUNCTION: Get User's Upcoming Sessions
-- ============================================================================
-- Optimized function to get a user's upcoming sessions

CREATE OR REPLACE FUNCTION get_user_upcoming_sessions(p_user_id UUID)
RETURNS TABLE (
  session_id UUID,
  session_date DATE,
  start_time TIME,
  duration_minutes INTEGER,
  group_name TEXT,
  sport_type sport_type,
  court_name TEXT,
  venue_name TEXT,
  venue_city TEXT,
  player_count BIGINT,
  is_confirmed BOOLEAN,
  is_organizer BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as session_id,
    s.session_date,
    s.start_time,
    s.duration_minutes,
    g.name as group_name,
    g.sport_type,
    c.name as court_name,
    v.name as venue_name,
    v.city as venue_city,
    COALESCE(spc.total_players, 0) as player_count,
    sp.is_confirmed,
    (g.organizer_id = p_user_id) as is_organizer
  FROM sessions s
  JOIN groups g ON g.id = s.group_id
  LEFT JOIN courts c ON c.id = s.court_id
  LEFT JOIN venues v ON v.id = c.venue_id
  LEFT JOIN session_player_counts spc ON spc.session_id = s.id
  LEFT JOIN session_players sp ON sp.session_id = s.id AND sp.user_id = p_user_id
  WHERE s.is_cancelled = false
    AND s.session_date >= CURRENT_DATE
    AND (sp.user_id = p_user_id OR g.organizer_id = p_user_id)
  ORDER BY s.session_date ASC, s.start_time ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_user_upcoming_sessions IS 
'Optimized function to get all upcoming sessions for a user in one query.';

-- ============================================================================
-- INITIAL REFRESH
-- ============================================================================

-- Refresh the materialized view with initial data
REFRESH MATERIALIZED VIEW group_member_counts;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant SELECT on views to authenticated users
GRANT SELECT ON group_member_counts TO authenticated;
GRANT SELECT ON session_player_counts TO authenticated;
GRANT SELECT ON groups_with_counts TO authenticated;
GRANT SELECT ON sessions_with_counts TO authenticated;
GRANT SELECT ON court_availability_summary TO authenticated;
GRANT SELECT ON user_session_history TO authenticated;
GRANT SELECT ON user_groups_with_details TO authenticated;
GRANT SELECT ON upcoming_sessions_with_details TO authenticated;
GRANT SELECT ON user_payment_summary TO authenticated;

-- Grant EXECUTE on function
GRANT EXECUTE ON FUNCTION get_user_upcoming_sessions TO authenticated;
