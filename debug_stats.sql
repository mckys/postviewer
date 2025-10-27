-- Check posts vs images counts
-- This would need to be run in your Supabase SQL editor

-- First, let's see what we're counting:
SELECT 
  (SELECT COUNT(*) FROM posts WHERE cover_image_url IS NOT NULL) as total_posts,
  (SELECT COUNT(*) FROM images) as total_images;

-- Check for posts with no images:
SELECT COUNT(*) as posts_without_images
FROM posts 
WHERE cover_image_url IS NOT NULL
  AND post_id NOT IN (SELECT DISTINCT post_id FROM images);

-- Check image counts per post:
SELECT 
  p.post_id,
  p.image_count as stored_count,
  COUNT(i.image_id) as actual_count
FROM posts p
LEFT JOIN images i ON p.post_id = i.post_id
WHERE p.cover_image_url IS NOT NULL
GROUP BY p.post_id, p.image_count
HAVING p.image_count != COUNT(i.image_id)
LIMIT 20;
