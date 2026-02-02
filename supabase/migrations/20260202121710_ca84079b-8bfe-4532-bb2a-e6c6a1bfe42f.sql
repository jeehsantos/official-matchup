-- Create table for lobby chat messages
CREATE TABLE public.quick_challenge_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.quick_challenges(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'user' CHECK (message_type IN ('system', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.quick_challenge_messages ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is in challenge
CREATE OR REPLACE FUNCTION public.is_challenge_participant(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quick_challenge_players
    WHERE challenge_id = _challenge_id
      AND user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.quick_challenges
    WHERE id = _challenge_id
      AND created_by = _user_id
  )
$$;

-- RLS Policies
-- Players who joined can read messages
CREATE POLICY "Challenge participants can read messages"
ON public.quick_challenge_messages
FOR SELECT
USING (public.is_challenge_participant(challenge_id, auth.uid()));

-- Players who joined can send messages
CREATE POLICY "Challenge participants can send messages"
ON public.quick_challenge_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_challenge_participant(challenge_id, auth.uid())
);

-- Sender can delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.quick_challenge_messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_challenge_messages;

-- Create cleanup function for when challenge status changes
CREATE OR REPLACE FUNCTION public.cleanup_challenge_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
    DELETE FROM public.quick_challenge_messages WHERE challenge_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on quick_challenges
CREATE TRIGGER trigger_cleanup_challenge_chat
AFTER UPDATE ON public.quick_challenges
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_challenge_chat();