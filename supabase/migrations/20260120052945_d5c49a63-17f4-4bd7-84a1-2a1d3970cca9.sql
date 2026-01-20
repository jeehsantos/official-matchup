-- Add RLS policy to allow users to view groups when they have a valid invitation
CREATE POLICY "Users can view groups with valid invitation" 
ON public.groups 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.group_invitations gi
    WHERE gi.group_id = groups.id
    AND gi.is_active = true
    AND (gi.expires_at IS NULL OR gi.expires_at > now())
    AND (gi.max_uses IS NULL OR gi.use_count < gi.max_uses)
  )
);