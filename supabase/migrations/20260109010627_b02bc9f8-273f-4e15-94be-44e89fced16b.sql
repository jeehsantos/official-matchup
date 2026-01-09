-- Add update policy for group_members to allow organizers to promote members
CREATE POLICY "Organizers can update members" 
ON public.group_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id 
    AND g.organizer_id = auth.uid()
  )
);