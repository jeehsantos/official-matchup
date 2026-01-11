-- Seed default sport categories
INSERT INTO public.sport_categories (name, display_name, icon, sort_order, is_active) VALUES
  ('futsal', 'Futsal', '⚽', 1, true),
  ('basketball', 'Basketball', '🏀', 2, true),
  ('tennis', 'Tennis', '🎾', 3, true),
  ('volleyball', 'Volleyball', '🏐', 4, true),
  ('badminton', 'Badminton', '🏸', 5, true),
  ('turf_hockey', 'Turf Hockey', '🏑', 6, true),
  ('other', 'Other', '🎲', 99, true)
ON CONFLICT (name) DO NOTHING;

-- Seed default surface types
INSERT INTO public.surface_types (name, display_name, sort_order, is_active) VALUES
  ('grass', 'Grass', 1, true),
  ('turf', 'Artificial Turf', 2, true),
  ('sand', 'Sand', 3, true),
  ('hard', 'Hard Court', 4, true),
  ('clay', 'Clay', 5, true),
  ('other', 'Other', 99, true)
ON CONFLICT (name) DO NOTHING;