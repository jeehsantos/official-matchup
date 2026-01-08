-- Create chat_conversations table for organizer-manager chats
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.court_availability(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organizer_id, court_manager_id)
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create group_invitations table for private group invite links
CREATE TABLE public.group_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;

-- Chat conversations policies
CREATE POLICY "Users can view their own conversations"
ON public.chat_conversations
FOR SELECT
USING (auth.uid() = organizer_id OR auth.uid() = court_manager_id);

CREATE POLICY "Organizers can create conversations after booking"
ON public.chat_conversations
FOR INSERT
WITH CHECK (
  auth.uid() = organizer_id
  AND EXISTS (
    SELECT 1 FROM public.court_availability ca
    JOIN public.courts c ON c.id = ca.court_id
    JOIN public.venues v ON v.id = c.venue_id
    WHERE ca.booked_by_user_id = auth.uid()
    AND v.owner_id = court_manager_id
  )
);

-- Chat messages policies
CREATE POLICY "Conversation participants can view messages"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = conversation_id
    AND (cc.organizer_id = auth.uid() OR cc.court_manager_id = auth.uid())
  )
);

CREATE POLICY "Conversation participants can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = conversation_id
    AND (cc.organizer_id = auth.uid() OR cc.court_manager_id = auth.uid())
  )
);

CREATE POLICY "Recipients can mark messages as read"
ON public.chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = conversation_id
    AND (cc.organizer_id = auth.uid() OR cc.court_manager_id = auth.uid())
  )
  AND sender_id != auth.uid()
);

-- Group invitations policies
CREATE POLICY "Group organizers can manage invitations"
ON public.group_invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id AND g.organizer_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view active invitations by code"
ON public.group_invitations
FOR SELECT
USING (is_active = true);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;

-- Add updated_at trigger for chat_conversations
CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();