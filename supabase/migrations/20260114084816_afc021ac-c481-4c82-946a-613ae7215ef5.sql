-- Add multi-court columns to courts table
ALTER TABLE courts 
  ADD COLUMN IF NOT EXISTS is_multi_court boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_court_id uuid REFERENCES courts(id) ON DELETE SET NULL;

-- Index for efficient child court lookups
CREATE INDEX IF NOT EXISTS idx_courts_parent_court_id ON courts(parent_court_id);