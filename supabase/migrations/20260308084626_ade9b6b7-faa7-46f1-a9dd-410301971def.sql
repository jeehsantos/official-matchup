CREATE POLICY "Court managers can view venue payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sessions s
    JOIN courts c ON c.id = s.court_id
    JOIN venues v ON v.id = c.venue_id
    WHERE s.id = payments.session_id
      AND v.owner_id = auth.uid()
  )
);