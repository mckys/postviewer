-- Add width and height columns to images table
ALTER TABLE images ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE images ADD COLUMN IF NOT EXISTS height INTEGER;

-- Add width and height columns to posts table for cover image dimensions
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_width INTEGER;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_height INTEGER;

-- Create index for faster queries when filtering by dimensions
CREATE INDEX IF NOT EXISTS idx_images_dimensions ON images(width, height);
