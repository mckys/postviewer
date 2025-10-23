import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://imhqapxkocdvhpqjsjip.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltaHFhcHhrb2NkdmhwcWpzamlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjczNDQsImV4cCI6MjA3NjAwMzM0NH0.yTM5IbziIEQOD4kHJ8Nd7uYgeIXdBnMZ0fZVJn3kAME'
);

const { data, error } = await supabase
  .from('creators')
  .select('username, sync_status, last_cursor, last_synced_at, total_posts');

if (error) {
  console.error('Error:', error);
} else {
  console.table(data);
  data.forEach(creator => {
    console.log(`\n${creator.username}:`);
    console.log(`  Status: ${creator.sync_status}`);
    console.log(`  Last cursor: ${creator.last_cursor || 'NULL'}`);
    console.log(`  Posts: ${creator.total_posts}`);
    console.log(`  Last synced: ${creator.last_synced_at}`);
  });
}

process.exit(0);
