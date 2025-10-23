-- Enable Row Level Security on all tables
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_interactions ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_profile VARCHAR(50) DEFAULT 'main',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add user_id column to creators table
ALTER TABLE creators ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS profile VARCHAR(50) DEFAULT 'main';

-- Add user_id column to post_interactions table
ALTER TABLE post_interactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE post_interactions ADD COLUMN IF NOT EXISTS profile VARCHAR(50) DEFAULT 'main';

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

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

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, current_profile)
  VALUES (new.id, 'main');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing data to assign to a default user (you'll need to replace 'YOUR_USER_ID' with your actual user ID)
-- Run this after you create your first account:
-- UPDATE creators SET user_id = 'YOUR_USER_ID', profile = 'main' WHERE user_id IS NULL;
-- UPDATE post_interactions SET user_id = 'YOUR_USER_ID', profile = 'main' WHERE user_id IS NULL;
