-- Add slideshow preferences to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS slideshow_duration INTEGER DEFAULT 3000,
ADD COLUMN IF NOT EXISTS slideshow_loop_post BOOLEAN DEFAULT true;

-- slideshow_duration: Duration per image in milliseconds (1000-10000)
-- slideshow_loop_post: true = loop within post, false = advance to next post
