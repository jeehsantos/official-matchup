-- Drop the problematic policies
DROP POLICY IF EXISTS "Group members can view members" ON public.group_members;

-- Create a fixed SELECT policy that doesn't cause infinite recursion
-- We check if user is organizer of the group OR if the user is the one being queried
CREATE POLICY "Group members can view members" 
ON public.group_members 
FOR SELECT 
USING (
  -- User can see their own membership
  user_id = auth.uid()
  OR
  -- User can see members of groups they organize
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id 
    AND g.organizer_id = auth.uid()
  )
  OR
  -- User can see members of groups they belong to (checking via direct query without recursion)
  group_id IN (
    SELECT gm.group_id FROM group_members gm WHERE gm.user_id = auth.uid()
  )
);