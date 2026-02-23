
-- Drop the existing UPDATE policy that requires is_booked = true in WITH CHECK
DROP POLICY "Authenticated users can book available slots" ON public.court_availability;

-- Create updated policy: users can update unbooked slots (to book them with any is_booked value)
CREATE POLICY "Authenticated users can book available slots"
ON public.court_availability
FOR UPDATE
USING (is_booked = false)
WITH CHECK (booked_by_user_id = auth.uid());
