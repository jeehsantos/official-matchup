
-- Drop the recursive policy
DROP POLICY IF EXISTS "Users with valid invitation can view group" ON public.groups;

-- Create a SECURITY DEFINER function to check invitations without triggering RLS on groups
CREATE OR REPLACE FUNCTION public.has_valid_invitation(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_invitations gi
    WHERE gi.group_id = _group_id
      AND gi.is_active = true
      AND (gi.expires_at IS NULL OR gi.expires_at > now())
      AND (gi.max_uses IS NULL OR gi.use_count < gi.max_uses)
  )
$$;

-- Re-create the policy using the function (no recursion)
CREATE POLICY "Users with valid invitation can view group"
ON public.groups FOR SELECT
USING (has_valid_invitation(id));
