-- Allow authenticated users to increment use_count on valid invitations when joining
CREATE POLICY "Users can increment use_count on valid invitations" 
ON public.group_invitations 
FOR UPDATE 
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (max_uses IS NULL OR use_count < max_uses)
)
WITH CHECK (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);