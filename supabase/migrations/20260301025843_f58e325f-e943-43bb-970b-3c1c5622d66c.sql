
-- Drop chat_messages first (depends on chat_conversations)
DROP TABLE IF EXISTS public.chat_messages CASCADE;

-- Drop chat_conversations
DROP TABLE IF EXISTS public.chat_conversations CASCADE;

-- Drop the cleanup function from archiving
DROP FUNCTION IF EXISTS public.cleanup_old_chat_messages();
