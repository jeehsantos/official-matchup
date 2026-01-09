-- Create a function to release court availability when a session is cancelled
-- This runs with SECURITY DEFINER so it can bypass RLS
CREATE OR REPLACE FUNCTION public.cancel_session_and_release_court(session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_organizer_id uuid;
BEGIN
  -- Get the group_id and verify the user is the organizer
  SELECT s.group_id, g.organizer_id INTO v_group_id, v_organizer_id
  FROM sessions s
  JOIN groups g ON g.id = s.group_id
  WHERE s.id = session_id;
  
  -- Check if user is the organizer
  IF v_organizer_id IS NULL OR v_organizer_id != auth.uid() THEN
    RETURN false;
  END IF;
  
  -- Release the court availability
  UPDATE court_availability
  SET 
    is_booked = false,
    booked_by_session_id = NULL,
    booked_by_group_id = NULL,
    booked_by_user_id = NULL,
    payment_status = 'pending'
  WHERE booked_by_session_id = session_id;
  
  -- Delete all session players
  DELETE FROM session_players WHERE session_players.session_id = cancel_session_and_release_court.session_id;
  
  -- Mark session as cancelled
  UPDATE sessions
  SET is_cancelled = true
  WHERE id = session_id;
  
  RETURN true;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cancel_session_and_release_court(uuid) TO authenticated;