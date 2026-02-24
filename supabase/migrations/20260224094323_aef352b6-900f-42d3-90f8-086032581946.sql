
-- Allow users to view a group if they have a valid, active invitation for it
CREATE POLICY "Users with valid invitation can view group"
ON public.groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM group_invitations gi
    WHERE gi.group_id = groups.id
      AND gi.is_active = true
      AND (gi.expires_at IS NULL OR gi.expires_at > now())
      AND (gi.max_uses IS NULL OR gi.use_count < gi.max_uses)
  )
);
