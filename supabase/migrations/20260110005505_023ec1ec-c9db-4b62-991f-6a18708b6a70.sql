-- Add policy allowing organizers to view their own groups
-- This fixes the RLS issue when creating a new group and immediately needing to view it

CREATE POLICY "Organizers can view own groups"
ON public.groups
FOR SELECT
USING (auth.uid() = organizer_id);