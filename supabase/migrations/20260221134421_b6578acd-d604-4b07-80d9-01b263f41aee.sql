
-- Drop the existing INSERT policy that requires is_booked = true
DROP POLICY "Authenticated users can insert bookings" ON public.court_availability;

-- Create a new INSERT policy that allows both is_booked = true and is_booked = false
CREATE POLICY "Authenticated users can insert bookings"
ON public.court_availability
FOR INSERT
WITH CHECK (booked_by_user_id = auth.uid());
