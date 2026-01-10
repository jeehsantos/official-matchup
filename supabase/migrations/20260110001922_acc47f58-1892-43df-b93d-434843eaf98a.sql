-- Add photo_urls array column to courts table
ALTER TABLE public.courts ADD COLUMN photo_urls text[] DEFAULT '{}';

-- Migrate existing single photo_url to the new array column
UPDATE public.courts 
SET photo_urls = ARRAY[photo_url] 
WHERE photo_url IS NOT NULL AND photo_url != '' AND (photo_urls IS NULL OR photo_urls = '{}');