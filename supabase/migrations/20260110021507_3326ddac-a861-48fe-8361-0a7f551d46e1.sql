-- Create session_type enum
CREATE TYPE public.session_type AS ENUM (
  'casual',
  'competitive', 
  'training',
  'private',
  'tournament'
);

-- Add session_type column to sessions table
ALTER TABLE public.sessions 
ADD COLUMN session_type public.session_type DEFAULT 'casual';