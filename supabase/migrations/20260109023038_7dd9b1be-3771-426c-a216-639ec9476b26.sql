-- Fix the groups SELECT policy (wrong column reference)
DROP POLICY IF EXISTS "Public groups are viewable" ON public.groups;

CREATE POLICY "Public groups are viewable" ON public.groups
FOR SELECT
USING (
  (is_public = true) OR 
  (auth.uid() = organizer_id) OR 
  (EXISTS (
    SELECT 1 FROM group_members
    WHERE group_members.group_id = groups.id 
    AND group_members.user_id = auth.uid()
  ))
);

-- Fix the sessions SELECT policy (wrong column reference)
DROP POLICY IF EXISTS "Sessions viewable by group members or rescue" ON public.sessions;

CREATE POLICY "Sessions viewable by group members or rescue" ON public.sessions
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = sessions.group_id 
    AND gm.user_id = auth.uid()
  )) OR 
  (EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = sessions.group_id 
    AND g.organizer_id = auth.uid()
  )) OR 
  ((is_rescue_open = true) AND (state = 'rescue'))
);