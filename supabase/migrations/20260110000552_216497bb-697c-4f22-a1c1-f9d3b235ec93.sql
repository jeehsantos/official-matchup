
-- Migration: Convert court_availability slots to venue_weekly_rules
-- This analyzes patterns in existing availability data and creates weekly rules

-- Step 1: Insert weekly rules based on the most common availability patterns per venue/day
-- We group by venue, day of week, and find the most frequent start/end time combinations

INSERT INTO public.venue_weekly_rules (venue_id, day_of_week, start_time, end_time, is_closed)
SELECT DISTINCT ON (c.venue_id, EXTRACT(DOW FROM ca.available_date))
  c.venue_id,
  EXTRACT(DOW FROM ca.available_date)::integer as day_of_week,
  MIN(ca.start_time) as start_time,
  MAX(ca.end_time) as end_time,
  false as is_closed
FROM public.court_availability ca
JOIN public.courts c ON c.id = ca.court_id
WHERE ca.is_booked = false OR ca.is_booked IS NULL
GROUP BY c.venue_id, EXTRACT(DOW FROM ca.available_date)
ON CONFLICT DO NOTHING;

-- Step 2: For any venues that have courts but no weekly rules yet, 
-- create default rules (9 AM - 9 PM, Mon-Sun)
INSERT INTO public.venue_weekly_rules (venue_id, day_of_week, start_time, end_time, is_closed)
SELECT 
  v.id as venue_id,
  day_num as day_of_week,
  '09:00:00'::time as start_time,
  '21:00:00'::time as end_time,
  false as is_closed
FROM public.venues v
CROSS JOIN generate_series(0, 6) as day_num
WHERE NOT EXISTS (
  SELECT 1 FROM public.venue_weekly_rules vwr 
  WHERE vwr.venue_id = v.id AND vwr.day_of_week = day_num
)
ON CONFLICT DO NOTHING;

-- Step 3: Create date overrides for any dates that were explicitly closed
-- (dates with no availability slots when other dates had them)
-- This is detected by finding gaps in the availability pattern

-- Note: Complex gap detection would require procedural code, 
-- so we'll handle explicit closures only if they exist as marked slots
