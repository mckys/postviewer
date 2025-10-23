import { supabase } from './supabase';
import { fetchImagesByUsername, CivitaiImage, groupImagesByPost } from './civitai';

interface SyncProgress {
  creator: string;
  currentPage: number;
  totalImages: number;
  totalPosts: number;
  status: 'syncing' | 'completed' | 'error';
  error?: string;
}

type ProgressCallback = (progress: SyncProgress) => void;

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sync a single creator's posts and images to database
 */
export async function syncCreator(
  username: string,
  onProgress?: ProgressCallback,
  options?: { fullBackfill?: boolean; userId?: string }
): Promise<void> {
  console.log(`🔄 Starting sync for ${username}`);

  try {
    // Get current user ID
    const userId = options?.userId;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User must be logged in to sync creators');
      }
      options = { ...options, userId: user.id };
    }

    // Get creator info to check last synced cursor (filtered by user)
    const { data: creatorInfo } = await supabase
      .from('creators')
      .select('last_cursor, total_posts')
      .eq('username', username)
      .eq('user_id', options.userId)
      .maybeSingle();

    const lastCursor = creatorInfo?.last_cursor || null;
    const existingPosts = creatorInfo?.total_posts || 0;
    console.log(`📄 Last cursor: ${lastCursor || '(starting from beginning)'}`);
    console.log(`📊 Existing posts in DB: ${existingPosts}`);

    const isInitialSync = !lastCursor && existingPosts === 0;
    const isFullBackfill = options?.fullBackfill || false;

    // Always start from beginning to catch new posts (cursor points to old data)
    // We'll stop when we hit posts we've already seen
    console.log(`${isInitialSync ? '🆕 Initial sync' : isFullBackfill ? '📜 Full backfill' : '🔄 Checking for new posts'}`);

    // Update creator status to syncing
    await supabase
      .from('creators')
      .update({ sync_status: 'syncing' })
      .eq('username', username)
      .eq('user_id', options.userId);

    // Always start without cursor to get newest posts first
    let currentCursor: string | undefined = undefined;
    let hasMore = true;
    let totalImages = 0;
    let totalPosts = 0;
    let consecutiveFullyExistingPages = 0;
    let requestCount = 0;
    const maxRequests = 50; // Limit to prevent infinite loops
    const batchSize = 5; // Fetch 5 requests per batch
    const batchDelayMs = 60000; // Wait 1 minute between batches

    while (hasMore && requestCount < maxRequests) {
      const isFirstRequest = requestCount === 0;
      try {
        // Check if sync was cancelled by user
        const { data: statusCheck } = await supabase
          .from('creators')
          .select('sync_status')
          .eq('username', username)
          .eq('user_id', options.userId)
          .maybeSingle();

        if (statusCheck?.sync_status !== 'syncing' && statusCheck?.sync_status !== 'pending') {
          console.log(`🛑 Sync cancelled by user for ${username}`);
          throw new Error('SYNC_CANCELLED');
        }

        // Add delay between batches (every 5 requests)
        if (requestCount > 0 && requestCount % batchSize === 0) {
          console.log(`⏸️  Batch complete. Waiting ${batchDelayMs/1000}s before next batch to avoid rate limits...`);
          await sleep(batchDelayMs);
        }

        // Add 3-second delay between individual requests (but not before the first request)
        if (requestCount > 0 && requestCount % batchSize !== 0) {
          await sleep(3000);
        }

        console.log(`📥 Fetching batch ${Math.floor(requestCount / batchSize) + 1}, request ${requestCount + 1} for ${username}${currentCursor ? ' (cursor: ' + currentCursor.substring(0, 20) + '...)' : ' (initial)'}`);

        const response = await fetchImagesByUsername(username, 200, currentCursor);

        if (!response.items || response.items.length === 0) {
          console.log(`✅ No more images for ${username}`);
          break;
        }

        totalImages += response.items.length;

        // Group images by post
        const postGroups = groupImagesByPost(response.items);

        // Log the post IDs we received
        const postIds = Array.from(postGroups.keys()).sort((a, b) => b - a); // Sort descending
        console.log(`📋 Received ${postGroups.size} posts in this batch:`);
        console.log(`   Post IDs: ${postIds.join(', ')}`);

        // Track how many posts we've seen that already exist
        let existingPostsCount = 0;
        const newPostIds: number[] = [];

        // Save posts and images to database
        for (const [postId, images] of postGroups.entries()) {
          // Check if this post already exists
          const { data: existingPost } = await supabase
            .from('posts')
            .select('post_id')
            .eq('post_id', postId)
            .maybeSingle();

          if (existingPost) {
            existingPostsCount++;
            // Check if post has images already
            const { count: imageCount } = await supabase
              .from('images')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', postId);

            if (imageCount && imageCount > 0) {
              // Post has images, skip it
              continue;
            }
            // Post exists but has no images, continue to save images
            newPostIds.push(postId);
          } else {
            newPostIds.push(postId);
          }
          const firstImage = images[0];

          // Insert or update post
          const { error: postError } = await supabase
            .from('posts')
            .upsert({
              post_id: postId,
              creator_username: username,
              cover_image_url: firstImage.url,
              cover_image_hash: firstImage.hash,
              image_count: images.length,
              nsfw: firstImage.nsfw,
              published_at: firstImage.createdAt || null,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'post_id'
            });

          if (postError) {
            console.error(`Error saving post ${postId}:`, postError);
            continue;
          }

          totalPosts++;

          // Insert images for this post
          let successfulImagesSaved = 0;
          for (const image of images) {
            const { error: imageError } = await supabase
              .from('images')
              .upsert({
                image_id: image.id,
                post_id: postId,
                url: image.url,
                hash: image.hash,
                width: image.width,
                height: image.height,
                nsfw: image.nsfw
              }, {
                onConflict: 'image_id',
                ignoreDuplicates: false
              });

            if (imageError) {
              // Ignore duplicate key errors (23505) - image already exists
              if (imageError.code !== '23505') {
                console.error(`Error saving image ${image.id}:`, imageError);
              } else {
                successfulImagesSaved++; // Count duplicates as successful
              }
            } else {
              successfulImagesSaved++;
            }
          }

          // Update image_count with actual saved count
          if (successfulImagesSaved !== images.length) {
            console.warn(`⚠️  Post ${postId}: Expected ${images.length} images, saved ${successfulImagesSaved}`);
            await supabase
              .from('posts')
              .update({ image_count: successfulImagesSaved })
              .eq('post_id', postId);
          }
        }

        // Track consecutive requests where all posts already exist
        if (existingPostsCount === postGroups.size && postGroups.size > 0) {
          consecutiveFullyExistingPages++;
          console.log(`✅ All ${postGroups.size} posts in this batch already exist (${consecutiveFullyExistingPages} consecutive)`);

          // For full backfill, keep going regardless
          if (isFullBackfill) {
            console.log(`📜 Full backfill: Continuing to fetch all posts...`);
          }
          // For regular sync, stop after 2 consecutive batches ONLY if we're just checking for new posts
          // Don't stop if there's still a nextPage and we haven't hit a reasonable limit
          else if (consecutiveFullyExistingPages >= 2 && !response.metadata.nextPage) {
            console.log(`🛑 Found ${consecutiveFullyExistingPages} consecutive batches with all existing posts and no more pages. All caught up!`);
            hasMore = false;
            break;
          } else if (consecutiveFullyExistingPages >= 2) {
            console.log(`🛑 Found ${consecutiveFullyExistingPages} consecutive batches with all existing posts. All caught up!`);
            hasMore = false;
            break;
          } else {
            console.log(`⏭️  Continuing to check for more posts...`);
          }
        } else {
          // Reset counter if we found new posts
          if (newPostIds.length > 0) {
            console.log(`📝 Found ${newPostIds.length} NEW posts in this batch: ${newPostIds.join(', ')}`);
          }
          consecutiveFullyExistingPages = 0;
        }

        // Update last_cursor after successful request (save progress)
        const nextPage = response.metadata.nextPage;
        let cursorValue: string | null = null;

        if (nextPage) {
          // Extract just the cursor value from the nextPage URL
          // nextPage might be a full URL or a relative path
          try {
            const url = new URL(nextPage, 'https://civitai.com');
            cursorValue = url.searchParams.get('cursor');
          } catch {
            // If URL parsing fails, try regex
            const cursorMatch = nextPage.match(/cursor=([^&]+)/);
            cursorValue = cursorMatch ? decodeURIComponent(cursorMatch[1]) : null;
          }

          console.log(`🔗 Next cursor value: ${cursorValue || 'NONE'}`);

          // Store just the cursor value, not the full URL
          if (cursorValue) {
            await supabase
              .from('creators')
              .update({ last_cursor: cursorValue })
              .eq('username', username)
              .eq('user_id', options.userId);
            console.log(`💾 Saved cursor to database`);
          } else {
            console.log(`⚠️  Could not extract cursor from nextPage`);
          }
        } else {
          console.log(`⚠️  No next cursor - reached end of available posts`);
        }

        // Report progress with actual unique post count from database
        const { count: currentPostCount } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('creator_username', username);

        // Update the total_posts in creators table for real-time UI update
        await supabase
          .from('creators')
          .update({ total_posts: currentPostCount || 0 })
          .eq('username', username)
          .eq('user_id', options.userId);

        if (onProgress) {
          onProgress({
            creator: username,
            currentPage: requestCount + 1,
            totalImages,
            totalPosts: currentPostCount || 0,
            status: 'syncing'
          });
        }

        // Check if there are more pages
        hasMore = !!response.metadata.nextPage || response.items.length === 200;
        // Update currentCursor to the extracted cursor value (not the full URL)
        currentCursor = cursorValue || undefined;
        requestCount++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // If rate limited, wait longer and continue
        if (errorMessage.includes('429')) {
          const waitTime = 120000; // 2 minutes
          console.warn(`⏳ Rate limited. Waiting ${waitTime/1000}s...`);
          await sleep(waitTime);
          continue; // Retry same request
        }

        // If 500 server error, retry with exponential backoff
        if (errorMessage.includes('500')) {
          const retryDelay = 10000; // 10 seconds
          console.warn(`⚠️  Server error (500). Retrying in ${retryDelay/1000}s...`);
          await sleep(retryDelay);
          continue; // Retry same request
        }

        // For other errors, log and throw
        console.error(`❌ Unrecoverable error:`, error);
        throw error;
      }
    }

    // Get actual unique post count from database
    const { count: actualPostCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('creator_username', username);

    // Update creator with sync completion
    await supabase
      .from('creators')
      .update({
        sync_status: 'completed',
        last_synced_at: new Date().toISOString(),
        total_posts: actualPostCount || 0,
        updated_at: new Date().toISOString()
      })
      .eq('username', username)
      .eq('user_id', options.userId);

    console.log(`✅ Sync completed for ${username}: ${actualPostCount} unique posts, ${totalImages} images fetched`);

    if (onProgress) {
      onProgress({
        creator: username,
        currentPage: requestCount,
        totalImages,
        totalPosts: actualPostCount || 0,
        status: 'completed'
      });
    }

  } catch (error) {
    console.error(`❌ Sync failed for ${username}:`, error);

    // Update creator with error status
    await supabase
      .from('creators')
      .update({
        sync_status: 'error',
        updated_at: new Date().toISOString()
      })
      .eq('username', username)
      .eq('user_id', options?.userId!);

    if (onProgress) {
      onProgress({
        creator: username,
        currentPage: 0,
        totalImages: 0,
        totalPosts: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    throw error;
  }
}

/**
 * Sync all creators that need syncing (for current user only)
 */
export async function syncAllCreators(onProgress?: ProgressCallback): Promise<void> {
  console.log('🔄 Starting sync for all creators');

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be logged in to sync creators');
  }

  // Get creators that need syncing for this user (pending or not synced in last 24 hours)
  const { data: creators, error } = await supabase
    .from('creators')
    .select('username, last_synced_at, sync_status')
    .eq('user_id', user.id)
    .or('sync_status.eq.pending,last_synced_at.is.null,last_synced_at.lt.' +
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error('Error fetching creators:', error);
    throw error;
  }

  if (!creators || creators.length === 0) {
    console.log('✅ All creators are up to date');
    return;
  }

  console.log(`📋 Found ${creators.length} creators to sync for user ${user.email}`);

  // Sync each creator sequentially
  for (const creator of creators) {
    await syncCreator(creator.username, onProgress, { userId: user.id });

    // Add delay between creators to avoid rate limiting
    await sleep(10000);
  }

  console.log('✅ All creators synced');
}

/**
 * Sync incomplete posts (posts with IDs but no images) by fetching via postId API
 */
export async function syncIncompletePosts(username: string): Promise<void> {
  console.log(`🔍 Finding incomplete posts for ${username}...`);

  // Get posts that have no cover_image_url (scraped by extension but not synced)
  const { data: incompletePosts, error } = await supabase
    .from('posts')
    .select('post_id')
    .eq('creator_username', username)
    .is('cover_image_url', null);

  if (error) {
    console.error('Error fetching incomplete posts:', error);
    throw error;
  }

  if (!incompletePosts || incompletePosts.length === 0) {
    console.log('✅ No incomplete posts to sync');
    return;
  }

  console.log(`📝 Found ${incompletePosts.length} incomplete posts. Fetching details...`);

  // Fetch details for each post using postId
  // This uses the reliable /api/v1/images?postId=X endpoint
  for (const post of incompletePosts) {
    try {
      await sleep(3000); // Rate limiting

      const response = await fetch(`https://civitai.com/api/v1/images?postId=${post.post_id}&limit=200&nsfw=true`);

      if (!response.ok) {
        console.warn(`⚠️  Failed to fetch post ${post.post_id}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        console.warn(`⚠️  No images found for post ${post.post_id}`);
        continue;
      }

      const firstImage = data.items[0];

      // Update post with full details
      await supabase
        .from('posts')
        .update({
          cover_image_url: firstImage.url,
          cover_image_hash: firstImage.hash,
          image_count: data.items.length,
          nsfw: firstImage.nsfw,
          published_at: firstImage.createdAt || null,
          updated_at: new Date().toISOString()
        })
        .eq('post_id', post.post_id);

      // Save all images
      for (const image of data.items) {
        await supabase
          .from('images')
          .upsert({
            image_id: image.id,
            post_id: post.post_id,
            url: image.url,
            hash: image.hash,
            width: image.width,
            height: image.height,
            nsfw: image.nsfw
          }, { onConflict: 'image_id' });
      }

      console.log(`✅ Synced post ${post.post_id} (${data.items.length} images)`);
    } catch (err) {
      console.error(`❌ Error syncing post ${post.post_id}:`, err);
    }
  }

  console.log(`✅ Completed syncing ${incompletePosts.length} posts for ${username}`);
}

/**
 * Check if any creators need syncing (for current user only)
 */
export async function needsSync(): Promise<boolean> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return false;
  }

  const { data: creators } = await supabase
    .from('creators')
    .select('username, last_synced_at, sync_status')
    .eq('user_id', user.id)
    .or('sync_status.eq.pending,last_synced_at.is.null,last_synced_at.lt.' +
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return (creators && creators.length > 0) || false;
}

/**
 * Force re-sync of all creators by resetting their sync status (for current user only)
 */
export async function forceResyncAll(): Promise<void> {
  console.log('🔄 Forcing re-sync of all creators...');

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be logged in to force resync');
  }

  await supabase
    .from('creators')
    .update({
      sync_status: 'pending',
      last_synced_at: null,
      last_cursor: null
    })
    .eq('user_id', user.id);

  console.log(`✅ All creators reset to pending status for user ${user.email}`);
}

/**
 * Force re-sync of a specific creator (for current user only)
 */
export async function forceResyncCreator(username: string): Promise<void> {
  console.log(`🔄 Forcing re-sync of ${username}...`);

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User must be logged in to force resync');
  }

  await supabase
    .from('creators')
    .update({
      sync_status: 'pending',
      last_synced_at: null,
      last_cursor: null
    })
    .eq('username', username)
    .eq('user_id', user.id);

  console.log(`✅ ${username} reset to pending status for user ${user.email}`);
}
