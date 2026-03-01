-- Allow pending payment quick challenges for at-booking Stripe flow
ALTER TABLE public.quick_challenges
DROP CONSTRAINT IF EXISTS quick_challenges_status_check;

ALTER TABLE public.quick_challenges
ADD CONSTRAINT quick_challenges_status_check
CHECK (
  status = ANY (
    ARRAY[
      'pending_payment'::text,
      'open'::text,
      'full'::text,
      'in_progress'::text,
      'completed'::text,
      'cancelled'::text
    ]
  )
);