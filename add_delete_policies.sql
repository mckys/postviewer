-- Add DELETE policy for images table
-- Allow authenticated users to delete any images
CREATE POLICY "Allow authenticated users to delete images"
ON images
FOR DELETE
TO authenticated
USING (true);

-- Add DELETE policy for posts table
-- Allow authenticated users to delete any posts
CREATE POLICY "Allow authenticated users to delete posts"
ON posts
FOR DELETE
TO authenticated
USING (true);
