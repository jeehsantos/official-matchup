-- Fix infinite recursion on group_members RLS by using a SECURITY DEFINER helper

-- 1) Helper function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = _group_id
        AND g.organizer_id = _user_id
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = _group_id
        AND gm.user_id = _user_id
    );
$$;

-- 2) Replace the problematic SELECT policy
DROP POLICY IF EXISTS "Group members can view members" ON public.group_members;

CREATE POLICY "Group members can view members"
ON public.group_members
FOR SELECT
USING (
  public.is_group_member(group_members.group_id, auth.uid())
);
