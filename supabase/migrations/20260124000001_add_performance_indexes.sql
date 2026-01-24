-- Performance Optimization: Add Critical Missing Indexes
-- This migration adds indexes to prevent performance degradation at scale

-- ============================================================================
-- SESSIONS TABLE INDEXES
-- ============================================================================

-- Index for getting sessions by group (used in GroupDetail.tsx)
CREATE INDEX IF NOT EXISTS idx_sessions_group_id 
ON sessions(group_id, session_date DESC) 
WHERE is_cancelled = false;

-- Index for getting sessions by date range (used in Games.tsx)
CREATE INDEX IF NOT EXISTS idx_sessions_date_range 
ON sessions(session_date, start_time) 
WHERE is_cancelled = false;

-- Index for getting sessions by court (used in CourtDetail.tsx)
CREATE INDEX IF NOT EXISTS idx_sessions_court_id 
ON sessions(court_id, session_date DESC) 
WHERE is_cancelled = false;

-- Index for rescue mode queries
CREATE INDEX IF NOT EXISTS idx_sessions_rescue 
ON sessions(state, is_rescue_open, session_date) 
WHERE is_cancelled = false AND is_rescue_open = true;

-- Index for payment deadline queries
CREATE INDEX IF NOT EXISTS idx_sessions_payment_deadline 
ON sessions(payment_deadline) 
WHERE is_cancelled = false AND payment_deadline > NOW();

-- ============================================================================
-- SESSION_PLAYERS TABLE INDEXES
-- ============================================================================

-- Index for getting all sessions for a user (used in Games.tsx)
CREATE INDEX IF NOT EXISTS idx_session_players_user_id 
ON session_players(user_id, joined_at DESC);

-- Index for counting confirmed players in a session
CREATE INDEX IF NOT EXISTS idx_session_players_session_confirmed 
ON session_players(session_id, is_confirmed);

-- Index for rescue players
CREATE INDEX IF NOT EXISTS idx_session_players_rescue 
ON session_players(session_id, is_from_rescue) 
WHERE is_from_rescue = true;

-- ============================================================================
-- GROUP_MEMBERS TABLE INDEXES
-- ============================================================================

-- Index for getting all groups for a user (used in Groups.tsx)
CREATE INDEX IF NOT EXISTS idx_group_members_user_id 
ON group_members(user_id, joined_at DESC);

-- Index for counting members in a group
CREATE INDEX IF NOT EXISTS idx_group_members_group_id 
ON group_members(group_id);

-- ============================================================================
-- GROUPS TABLE INDEXES
-- ============================================================================

-- Index for getting groups by organizer (used in Groups.tsx)
CREATE INDEX IF NOT EXISTS idx_groups_organizer 
ON groups(organizer_id, created_at DESC) 
WHERE is_active = true;

-- Index for public groups by city (used in Discover.tsx)
CREATE INDEX IF NOT EXISTS idx_groups_public_city 
ON groups(city, sport_type, created_at DESC) 
WHERE is_public = true AND is_active = true;

-- Index for filtering by sport type
CREATE INDEX IF NOT EXISTS idx_groups_sport_type 
ON groups(sport_type, is_public, created_at DESC) 
WHERE is_active = true;

-- ============================================================================
-- COURTS TABLE INDEXES
-- ============================================================================

-- Index for getting courts by venue (used in Courts.tsx)
CREATE INDEX IF NOT EXISTS idx_courts_venue_id 
ON courts(venue_id) 
WHERE is_active = true;

-- Index for filtering by sport type
CREATE INDEX IF NOT EXISTS idx_courts_sport_type 
ON courts(sport_type, is_active);

-- Index for filtering by ground type
CREATE INDEX IF NOT EXISTS idx_courts_ground_type 
ON courts(ground_type, is_active);

-- Composite index for common filters
CREATE INDEX IF NOT EXISTS idx_courts_filters 
ON courts(sport_type, ground_type, is_indoor, is_active);

-- ============================================================================
-- VENUES TABLE INDEXES
-- ============================================================================

-- Index for getting venues by owner (used in ManagerVenues.tsx)
CREATE INDEX IF NOT EXISTS idx_venues_owner_id 
ON venues(owner_id, created_at DESC) 
WHERE is_active = true;

-- Index for filtering by city (used in Courts.tsx)
CREATE INDEX IF NOT EXISTS idx_venues_city 
ON venues(city, is_active);

-- ============================================================================
-- PAYMENTS TABLE INDEXES
-- ============================================================================

-- Index for getting payments by user (used in Profile.tsx)
CREATE INDEX IF NOT EXISTS idx_payments_user_id 
ON payments(user_id, created_at DESC);

-- Index for getting payments by session (used in GameDetail.tsx)
CREATE INDEX IF NOT EXISTS idx_payments_session_id 
ON payments(session_id, status);

-- Index for pending payments
CREATE INDEX IF NOT EXISTS idx_payments_pending 
ON payments(status, created_at DESC) 
WHERE status = 'pending';

-- Index for Stripe payment intent lookups
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent 
ON payments(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================================================
-- NOTIFICATIONS TABLE INDEXES
-- ============================================================================

-- Index for getting unread notifications (used in MobileLayout.tsx)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, created_at DESC) 
WHERE is_read = false;

-- Index for all user notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_all 
ON notifications(user_id, created_at DESC);

-- Index for notification type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications(user_id, type, created_at DESC);

-- ============================================================================
-- COURT_AVAILABILITY TABLE INDEXES
-- ============================================================================

-- Index for finding available slots (most common query)
CREATE INDEX IF NOT EXISTS idx_court_availability_available 
ON court_availability(court_id, available_date, start_time) 
WHERE is_booked = false;

-- Index for payment status queries
CREATE INDEX IF NOT EXISTS idx_court_availability_payment 
ON court_availability(payment_status, available_date) 
WHERE is_booked = true;

-- Index for booked slots by group
CREATE INDEX IF NOT EXISTS idx_court_availability_group 
ON court_availability(booked_by_group_id, available_date) 
WHERE booked_by_group_id IS NOT NULL;

-- Index for booked slots by user
CREATE INDEX IF NOT EXISTS idx_court_availability_user 
ON court_availability(booked_by_user_id, available_date) 
WHERE booked_by_user_id IS NOT NULL;

-- ============================================================================
-- PROFILES TABLE INDEXES
-- ============================================================================

-- Index for searching profiles by city
CREATE INDEX IF NOT EXISTS idx_profiles_city 
ON profiles(city) 
WHERE city IS NOT NULL;

-- Index for searching by preferred sports
CREATE INDEX IF NOT EXISTS idx_profiles_sports 
ON profiles USING gin(preferred_sports);

-- ============================================================================
-- CHAT TABLES INDEXES
-- ============================================================================

-- Index for getting conversations by organizer
CREATE INDEX IF NOT EXISTS idx_chat_conversations_organizer 
ON chat_conversations(organizer_id, updated_at DESC);

-- Index for getting conversations by manager
CREATE INDEX IF NOT EXISTS idx_chat_conversations_manager 
ON chat_conversations(court_manager_id, updated_at DESC);

-- Index for getting messages by conversation
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation 
ON chat_messages(conversation_id, created_at ASC);

-- Index for unread messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread 
ON chat_messages(conversation_id, is_read) 
WHERE is_read = false;

-- ============================================================================
-- GROUP_INVITATIONS TABLE INDEXES
-- ============================================================================

-- Index for active invitations by group
CREATE INDEX IF NOT EXISTS idx_group_invitations_group 
ON group_invitations(group_id, is_active) 
WHERE is_active = true;

-- Index for invitation expiry checks
CREATE INDEX IF NOT EXISTS idx_group_invitations_expires 
ON group_invitations(expires_at) 
WHERE is_active = true AND expires_at IS NOT NULL;

-- ============================================================================
-- EQUIPMENT TABLES INDEXES
-- ============================================================================

-- Index for getting equipment by venue
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_venue 
ON equipment_inventory(venue_id, is_active) 
WHERE is_active = true;

-- Index for booking equipment lookups
CREATE INDEX IF NOT EXISTS idx_booking_equipment_booking 
ON booking_equipment(booking_id);

-- ============================================================================
-- USER_ROLES TABLE INDEXES
-- ============================================================================

-- Index for role lookups (used in auth-context.tsx)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id, role);

-- ============================================================================
-- ANALYZE TABLES
-- ============================================================================

-- Update statistics for query planner
ANALYZE sessions;
ANALYZE session_players;
ANALYZE group_members;
ANALYZE groups;
ANALYZE courts;
ANALYZE venues;
ANALYZE payments;
ANALYZE notifications;
ANALYZE court_availability;
ANALYZE profiles;
ANALYZE chat_conversations;
ANALYZE chat_messages;
ANALYZE group_invitations;
ANALYZE equipment_inventory;
ANALYZE user_roles;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_sessions_group_id IS 'Optimizes group session queries';
COMMENT ON INDEX idx_session_players_user_id IS 'Optimizes user session history queries';
COMMENT ON INDEX idx_group_members_user_id IS 'Optimizes user group membership queries';
COMMENT ON INDEX idx_groups_public_city IS 'Optimizes public group discovery by location';
COMMENT ON INDEX idx_courts_filters IS 'Optimizes court filtering with multiple criteria';
COMMENT ON INDEX idx_payments_pending IS 'Optimizes pending payment queries';
COMMENT ON INDEX idx_notifications_user_unread IS 'Optimizes unread notification badge queries';
COMMENT ON INDEX idx_court_availability_available IS 'Optimizes available slot searches';
