-- Add show_nsfw column to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS show_nsfw BOOLEAN DEFAULT true;
