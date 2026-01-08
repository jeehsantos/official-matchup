-- Add booking metadata for direct player bookings
ALTER TABLE public.court_availability
  ADD COLUMN IF NOT EXISTS booked_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'pending'::public.payment_status;

-- Allow authenticated players to book an available slot exactly once
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'court_availability'
      AND policyname = 'Players can book available slots'
  ) THEN
    CREATE POLICY "Players can book available slots"
    ON public.court_availability
    FOR UPDATE
    USING (is_booked = false)
    WITH CHECK (
      is_booked = true
      AND booked_by_user_id = auth.uid()
      AND payment_status = 'pending'::public.payment_status
    );
  END IF;
END $$;
