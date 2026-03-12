DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payments'
      AND policyname = 'Organizers can view group session payments'
  ) THEN
    CREATE POLICY "Organizers can view group session payments"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.sessions s
        JOIN public.groups g ON g.id = s.group_id
        WHERE s.id = payments.session_id
          AND g.organizer_id = auth.uid()
      )
    );
  END IF;
END
$$;