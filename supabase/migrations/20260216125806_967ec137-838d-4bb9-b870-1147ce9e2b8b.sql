-- Add unique constraint on (session_id, user_id) so payment upserts work correctly
CREATE UNIQUE INDEX IF NOT EXISTS payments_session_user_unique ON public.payments (session_id, user_id);