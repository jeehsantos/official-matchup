-- Fix the overly permissive notifications INSERT policy
-- Drop the old policy and create a more secure one
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Create a more secure policy that allows authenticated users to receive notifications
-- Notifications are typically created by edge functions using service role
CREATE POLICY "Authenticated users receive notifications" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid() = user_id);