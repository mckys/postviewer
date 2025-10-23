-- Enable Row Level Security on tables
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;

-- Add user_id column to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to post_interactions table
ALTER TABLE post_interactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create RLS policies for creators
CREATE POLICY "Users can view own creators" ON creators
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own creators" ON creators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own creators" ON creators
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own creators" ON creators
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for post_interactions
CREATE POLICY "Users can view own interactions" ON post_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions" ON post_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interactions" ON post_interactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interactions" ON post_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for posts (read-only, all users can see all posts)
CREATE POLICY "All authenticated users can view posts" ON posts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create RLS policies for images (read-only, all users can see all images)
CREATE POLICY "All authenticated users can view images" ON images
  FOR SELECT USING (auth.role() = 'authenticated');

-- Update existing data to assign to your user (replace 'YOUR_USER_ID' with your actual user ID from auth.users)
-- Run this after you create your first account:
-- UPDATE creators SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
-- UPDATE post_interactions SET user_id = 'YOUR_USER_ID' WHERE user_id IS NULL;
