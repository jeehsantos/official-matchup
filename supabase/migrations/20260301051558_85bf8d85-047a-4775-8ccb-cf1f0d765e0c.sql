
-- Allow court managers to view profiles of users who booked their courts
CREATE POLICY "Court managers can view booker profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM court_availability ca
    JOIN courts c ON c.id = ca.court_id
    JOIN venues v ON v.id = c.venue_id
    WHERE ca.booked_by_user_id = profiles.user_id
      AND v.owner_id = auth.uid()
  )
);
