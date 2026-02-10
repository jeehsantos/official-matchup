
-- Add allowed_sports array to venues table for tracking which sports are available at the venue
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS allowed_sports text[] DEFAULT '{}';
