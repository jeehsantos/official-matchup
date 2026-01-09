-- Fix booking constraint: allow multiple sessions per group per day
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_group_id_session_date_key;

-- Session-based chat conversations
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

-- Drop any UNIQUE constraint on (organizer_id, court_manager_id) if present
DO $$
DECLARE
  cname text;
BEGIN
  SELECT c.conname INTO cname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'chat_conversations'
    AND c.contype = 'u'
    AND pg_get_constraintdef(c.oid) LIKE '%(organizer_id, court_manager_id)%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.chat_conversations DROP CONSTRAINT %I', cname);
  END IF;
END $$;

-- Ensure one conversation per session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'chat_conversations'
      AND c.conname = 'chat_conversations_session_id_unique'
  ) THEN
    EXECUTE 'ALTER TABLE public.chat_conversations ADD CONSTRAINT chat_conversations_session_id_unique UNIQUE (session_id)';
  END IF;
END $$;

-- Make sure deleting a conversation deletes its messages too
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_conversation_id_fkey;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id)
  REFERENCES public.chat_conversations(id)
  ON DELETE CASCADE;

-- RLS: replace chat_conversations policies with session-based rules
DROP POLICY IF EXISTS "Organizers can create conversations after booking" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Session participants can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Session participants can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Session participants can update conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Session participants can delete expired conversations" ON public.chat_conversations;

-- Create policy: organizer creates conversation for a session, and manager must match venue owner
CREATE POLICY "Session participants can create conversations"
ON public.chat_conversations
FOR INSERT
WITH CHECK (
  auth.uid() = organizer_id
  AND session_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.sessions s
    JOIN public.groups g ON g.id = s.group_id
    JOIN public.courts c ON c.id = s.court_id
    JOIN public.venues v ON v.id = c.venue_id
    WHERE s.id = chat_conversations.session_id
      AND g.organizer_id = auth.uid()
      AND v.owner_id = chat_conversations.court_manager_id
  )
);

-- Create policy: participants can view
CREATE POLICY "Session participants can view conversations"
ON public.chat_conversations
FOR SELECT
USING (
  auth.uid() = organizer_id
  OR auth.uid() = court_manager_id
);

-- Create policy: participants can update (e.g. housekeeping)
CREATE POLICY "Session participants can update conversations"
ON public.chat_conversations
FOR UPDATE
USING (
  auth.uid() = organizer_id
  OR auth.uid() = court_manager_id
);

-- Create policy: participants can delete after expiry
CREATE POLICY "Session participants can delete expired conversations"
ON public.chat_conversations
FOR DELETE
USING (
  expires_at IS NOT NULL
  AND expires_at <= now()
  AND (auth.uid() = organizer_id OR auth.uid() = court_manager_id)
);
