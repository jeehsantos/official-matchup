
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;

-- Create a restricted INSERT policy that only allows non-privileged roles
-- The handle_new_user trigger (SECURITY DEFINER) bypasses RLS, so initial role assignment still works
-- Admin and venue_staff roles must be granted through service-role edge functions only
CREATE POLICY "Users can insert own non-privileged roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND role NOT IN ('admin'::app_role, 'venue_staff'::app_role)
);
