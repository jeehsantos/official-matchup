CREATE POLICY "Court managers can view venue staff profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs
    JOIN public.venues v ON v.id = vs.venue_id
    WHERE vs.user_id = profiles.user_id
      AND v.owner_id = auth.uid()
  )
);