-- Fix infinite recursion by dropping the problematic policy and replacing with a simpler one
-- The "Users can view groups with valid invitation" policy causes recursion because 
-- group_invitations has FK to groups, and fetching group_invitations triggers groups RLS

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view groups with valid invitation" ON public.groups;

-- The existing policies are sufficient:
-- 1. "Organizers can view own groups" - for group owners
-- 2. "Public groups are viewable" - uses can_view_group() which is SECURITY DEFINER

-- We need a policy that allows users to SELECT groups they're querying by ID 
-- without causing recursion. The issue is that when creating a booking,
-- the user queries groups where organizer_id = their own ID, which should work with 
-- "Organizers can view own groups" policy.

-- The problem was the invitation policy was checking groups.id internally.
-- Instead, let's create a simpler policy for group members to view their groups directly

DROP POLICY IF EXISTS "Group members can view their groups" ON public.groups;

CREATE POLICY "Group members can view their groups"
ON public.groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = groups.id 
    AND gm.user_id = auth.uid()
  )
);