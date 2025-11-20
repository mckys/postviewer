-- Add last_checked_at column to creators table for tracking lightweight update checks
-- This allows us to distinguish between full syncs and quick update checks

ALTER TABLE creators
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the column
COMMENT ON COLUMN creators.last_checked_at IS 'Timestamp of last lightweight check for new posts (not full sync)';

-- Optional: Set initial values to match last_synced_at for existing creators
UPDATE creators
SET last_checked_at = last_synced_at
WHERE last_checked_at IS NULL AND last_synced_at IS NOT NULL;
