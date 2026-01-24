-- Fix group invitation visibility issue
-- Allow users to view groups when they have a valid invitation code

-- Drop and recreate the can_view_group function to include invitation check
DROP FUNCTION IF EXISTS public.can_view_group(uuid, uuid);

CREATE FUNCTION public.can_view_group(_group_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    -- Public groups
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = _group_id AND g.is_public = true
    )
    OR
    -- Organizer
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = _group_id AND g.organizer_id = _user_id
    )
    OR
    -- Group member
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = _group_id AND gm.user_id = _user_id
    )
    OR
    -- Has valid invitation (active and not expired)
    EXISTS (
      SELECT 1 FROM public.group_invitations gi
      WHERE gi.group_id = _group_id 
        AND gi.is_active = true
        AND (gi.expires_at IS NULL OR gi.expires_at > NOW())
        AND (gi.max_uses IS NULL OR gi.use_count < gi.max_uses)
    )
    OR
    -- Has open rescue session
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.group_id = _group_id
        AND s.is_cancelled = false
        AND s.is_rescue_open = true
        AND s.state = 'rescue'::session_state
    );
$$;
