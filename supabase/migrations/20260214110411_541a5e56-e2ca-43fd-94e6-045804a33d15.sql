
-- Create platform_settings table for admin-configurable commission fees
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_fee numeric NOT NULL DEFAULT 1.50,
  manager_fee_percentage numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage platform settings
CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read platform settings (to display fees)
CREATE POLICY "Platform settings viewable by authenticated"
ON public.platform_settings
FOR SELECT
USING (true);

-- Seed default settings
INSERT INTO public.platform_settings (player_fee, manager_fee_percentage, is_active)
VALUES (1.50, 0, true);
