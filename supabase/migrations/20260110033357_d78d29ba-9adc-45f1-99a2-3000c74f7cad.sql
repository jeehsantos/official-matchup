-- Drop the existing restrictive update policy for players
DROP POLICY IF EXISTS "Players can book available slots" ON public.court_availability;

-- Create a more permissive policy for authenticated users to book slots
CREATE POLICY "Authenticated users can book available slots"
ON public.court_availability
FOR UPDATE
TO authenticated
USING (is_booked = false)
WITH CHECK (
  is_booked = true 
  AND booked_by_user_id = auth.uid()
);

-- Also allow users to update their own bookings (for cancellation etc)
CREATE POLICY "Users can update their own bookings"
ON public.court_availability
FOR UPDATE
TO authenticated
USING (booked_by_user_id = auth.uid())
WITH CHECK (booked_by_user_id = auth.uid() OR booked_by_user_id IS NULL);