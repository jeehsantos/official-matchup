-- Create security definer function to check group visibility without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.can_view_group(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
    -- Has open rescue session
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.group_id = _group_id
        AND s.is_cancelled = false
        AND s.is_rescue_open = true
        AND s.state = 'rescue'::session_state
    )
$$;

-- Update the groups SELECT policy to use the security definer function
DROP POLICY IF EXISTS "Public groups are viewable" ON public.groups;

CREATE POLICY "Public groups are viewable"
ON public.groups
FOR SELECT
USING (
  public.can_view_group(id, auth.uid())
);