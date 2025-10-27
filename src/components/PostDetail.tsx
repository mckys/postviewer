import { useState, useEffect } from 'react';
import { supabase, ensureHttps } from '../lib/supabase';
import { CivitaiImage } from '../lib/civitai';
import { Pencil, PencilOff, RefreshCw, ExternalLink, Download, Play, Settings, Info } from 'lucide-react';
import JSZip from 'jszip';
import { useSwipeable } from 'react-swipeable';

interface PostDetailProps {
  postId: number;
  onImageClick?: (images: CivitaiImage[], startIndex: number, nextPostId?: number, prevPostId?: number) => void;
  onBack?: (postId?: number, imageCount?: number, coverImageUrl?: string) => void;
  onNavigatePost?: (postId: number) => void;
  onCreatorClick?: (username: string) => void;
  sourceView?: 'feed' | 'myposts' | 'favorites' | 'creator-feed';
  creatorUsername?: string;
  onImageCountChange?: (count: number) => void;
  onCoverImageChange?: (url: string) => void;
}

export const PostDetail = ({ postId, onImageClick, onBack, onNavigatePost, onCreatorClick, sourceView, creatorUsername, onImageCountChange, onCoverImageChange }: PostDetailProps) => {
  const [images, setImages] = useState<CivitaiImage[]>([]);
  const [postTitle, setPostTitle] = useState<string>('');
  const [creatorName, setCreatorName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lastSyncDate, setLastSyncDate] = useState<string>('');

  // Notify parent of image count changes
  useEffect(() => {
    if (images.length > 0) {
      console.log(`📊 Notifying parent of image count: ${images.length} for post ${postId}`);
      onImageCountChange?.(images.length);
    }
  }, [images.length, onImageCountChange, postId]);
  const [error, setError] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [prevPostId, setPrevPostId] = useState<number | null>(null);
  const [nextPostId, setNextPostId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [actualDimensions, setActualDimensions] = useState<Map<number, { width: number; height: number }>>(new Map());
  const [editMode, setEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [mediaTypes, setMediaTypes] = useState<Map<number, 'video' | 'image'>>(new Map());
  const [allowedToLoadCount, setAllowedToLoadCount] = useState(2); // Start with first 2 images

  // Progressive image loading: increase allowed count as images load
  useEffect(() => {
    if (loadedImages.size >= allowedToLoadCount && allowedToLoadCount < images.length) {
      // When current batch is loaded, allow 2 more images
      const timer = setTimeout(() => {
        setAllowedToLoadCount(prev => Math.min(prev + 2, images.length));
      }, 100); // Small delay to prevent overwhelming
      return () => clearTimeout(timer);
    }
  }, [loadedImages.size, allowedToLoadCount, images.length]);

  useEffect(() => {
    // Reset progressive loading when post changes
    setAllowedToLoadCount(2);
    setLoadedImages(new Set());
    fetchPost();
    fetchAdjacentPosts();
  }, [postId, sourceView, creatorUsername]);

  async function fetchAdjacentPosts() {
    try {
      console.log('='.repeat(80));
      console.log('🔍 FETCHING ADJACENT POSTS');
      console.log(`   Current Post ID: ${postId}`);
      console.log(`   Source View: ${sourceView}`);
      console.log(`   Creator Username (for creator-feed): ${creatorUsername || 'N/A'}`);

      let prevQuery = supabase.from('posts').select('post_id');
      let nextQuery = supabase.from('posts').select('post_id');

      // Apply filters based on source view
      if (sourceView === 'creator-feed' && creatorUsername) {
        // Creator feed: same creator only
        console.log(`   🎯 Filter Mode: CREATOR FEED (${creatorUsername})`);
        prevQuery = prevQuery.eq('creator_username', creatorUsername);
        nextQuery = nextQuery.eq('creator_username', creatorUsername);
      } else if (sourceView === 'myposts') {
        // My posts: same creator (my username from database)
        console.log(`   🎯 Filter Mode: MY POSTS`);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userSettings } = await supabase
            .from('user_settings')
            .select('civitai_username')
            .eq('user_id', user.id)
            .maybeSingle();

          const myUsername = userSettings?.civitai_username;
          console.log(`   👤 My Username from database: "${myUsername}"`);

          if (myUsername) {
            prevQuery = prevQuery.eq('creator_username', myUsername);
            nextQuery = nextQuery.eq('creator_username', myUsername);
          } else {
            console.log('   ⚠️ WARNING: civitai_username is not set in user_settings!');
          }
        }
      } else if (sourceView === 'favorites') {
        // Favorites: only favorited posts for THIS user
        console.log(`   🎯 Filter Mode: FAVORITES`);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('   ⚠️ No user found, cannot load favorites');
          setPrevPostId(null);
          setNextPostId(null);
          return;
        }

        const { data: favInteractions } = await supabase
          .from('post_interactions')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('is_favorited', true);

        const favPostIds = favInteractions?.map(i => i.post_id) || [];
        console.log(`   ⭐ Found ${favPostIds.length} favorited posts for user ${user.id}`);
        if (favPostIds.length > 0) {
          prevQuery = prevQuery.in('post_id', favPostIds);
          nextQuery = nextQuery.in('post_id', favPostIds);
        } else {
          // No favorites, no navigation
          console.log(`   ⚠️ No favorites found, no navigation`);
          setPrevPostId(null);
          setNextPostId(null);
          return;
        }
      } else if (sourceView === 'feed') {
        // Main feed: only posts from followed creators, excluding my posts
        console.log(`   🎯 Filter Mode: MAIN FEED`);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: myCreators } = await supabase
            .from('creators')
            .select('username')
            .eq('user_id', user.id);

          const creatorUsernames = myCreators?.map(c => c.username) || [];
          console.log(`   👥 Following ${creatorUsernames.length} creators: ${creatorUsernames.join(', ')}`);

          if (creatorUsernames.length > 0) {
            prevQuery = prevQuery.in('creator_username', creatorUsernames);
            nextQuery = nextQuery.in('creator_username', creatorUsernames);
          }

          // Exclude my posts if username is set
          const { data: userSettings } = await supabase
            .from('user_settings')
            .select('civitai_username')
            .eq('user_id', user.id)
            .maybeSingle();

          const myUsername = userSettings?.civitai_username;
          if (myUsername) {
            console.log(`   🚫 Excluding posts from: ${myUsername}`);
            prevQuery = prevQuery.neq('creator_username', myUsername);
            nextQuery = nextQuery.neq('creator_username', myUsername);
          }
        }
      } else {
        console.log(`   ⚠️ Unknown source view: ${sourceView}`);
      }

      // Get the previous post (higher post_id = newer)
      const { data: prevData } = await prevQuery
        .gt('post_id', postId)
        .not('cover_image_url', 'is', null)
        .order('post_id', { ascending: true })
        .limit(1)
        .maybeSingle();

      setPrevPostId(prevData?.post_id || null);

      // Get the next post (lower post_id = older)
      const { data: nextData } = await nextQuery
        .lt('post_id', postId)
        .not('cover_image_url', 'is', null)
        .order('post_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('');
      console.log('📊 RESULTS:');
      console.log(`   ⬅️  Previous Post ID: ${prevData?.post_id || '❌ NONE'}`);
      console.log(`   ➡️  Next Post ID: ${nextData?.post_id || '❌ NONE'}`);
      console.log('='.repeat(80));

      setPrevPostId(prevData?.post_id || null);
      setNextPostId(nextData?.post_id || null);

      console.log(`✅ State updated - Prev: ${prevData?.post_id || null}, Next: ${nextData?.post_id || null}`);
    } catch (err) {
      console.error('Error fetching adjacent posts:', err);
    }
  }

  async function fetchPost() {
    try {
      setLoading(true);
      setError(null);

      // Get post info and images from database
      const { data: post } = await supabase
        .from('posts')
        .select('title, cover_image_url, updated_at, creator_username')
        .eq('post_id', postId)
        .maybeSingle();

      if (post?.title) {
        setPostTitle(post.title);
      }
      if (post?.cover_image_url) {
        setCoverImageUrl(post.cover_image_url);
      }
      if (post?.creator_username) {
        setCreatorName(post.creator_username);
      }

      // Format last sync date
      if (post?.updated_at) {
        const date = new Date(post.updated_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
          setLastSyncDate('Today');
        } else if (date.toDateString() === yesterday.toDateString()) {
          setLastSyncDate('Yesterday');
        } else {
          setLastSyncDate(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        }
      }

      // Get current images from database
      const { data: imagesData, error: imagesError } = await supabase
        .from('images')
        .select('image_id, url, hash, width, height, nsfw, position')
        .eq('post_id', postId)
        .order('position', { ascending: true, nullsFirst: false })
        .order('image_id', { ascending: true });

      if (imagesError) throw imagesError;

      const dbImageCount = imagesData?.length || 0;
      console.log(`📸 Fetched ${dbImageCount} images from database for post ${postId}`);

      // Convert to CivitaiImage format
      const civitaiImages: CivitaiImage[] = (imagesData || []).map(img => ({
        id: img.image_id,
        url: img.url,
        hash: img.hash || '',
        width: img.width || 0,
        height: img.height || 0,
        nsfw: img.nsfw || false,
        postId: postId
      }));

      // If no images but we have a cover image, use it as a placeholder
      if (civitaiImages.length === 0 && post?.cover_image_url) {
        civitaiImages.push({
          id: 0, // Special ID to indicate this is just the cover
          url: post.cover_image_url,
          hash: '',
          width: 0,
          height: 0,
          nsfw: false,
          postId: postId
        });
      }

      // Set images immediately for fast display
      setImages(civitaiImages);
      setLoading(false);

      // Auto-sync when DB has 0 images OR periodically check for updates
      console.log(`🔍 Checking Civitai API for updates to post ${postId}...`);

      // Do API check in background without blocking UI
      const apiResponse = await fetch(`https://civitai.com/api/v1/images?postId=${postId}&limit=200&nsfw=true`);
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        const apiImageCount = apiData.items?.length || 0;
        console.log(`📡 API returned ${apiImageCount} images for post ${postId}`);

        // If API has images and (DB is empty OR API has more images), sync them
        if (apiImageCount > 0 && (dbImageCount === 0 || apiImageCount > dbImageCount)) {
          console.log(`🔄 Auto-syncing ${apiImageCount - dbImageCount} new images...`);
          const existingImageIds = new Set(imagesData?.map(img => img.image_id) || []);
          const newImages = apiData.items.filter((img: any) => !existingImageIds.has(img.id));

          // Insert new images into database
          if (newImages.length > 0) {
            const imagesToInsert = newImages.map((img: any) => ({
              image_id: img.id,
              post_id: postId,
              url: img.url,
              hash: img.hash,
              width: img.width,
              height: img.height,
              nsfw: img.nsfw === 'X' || img.nsfw === 'Mature' || img.nsfwLevel >= 4
            }));

            const { error: insertError } = await supabase
              .from('images')
              .upsert(imagesToInsert, { onConflict: 'image_id' });

            if (insertError) {
              console.error('❌ Error upserting new images:', insertError);
            } else {
              console.log(`✅ Successfully auto-synced ${newImages.length} new images`);
            }
          }

          // Always update post image count and refresh, even if insert failed
          await supabase
            .from('posts')
            .update({
              updated_at: new Date().toISOString(),
              image_count: apiImageCount
            })
            .eq('post_id', postId);

          // Refresh images from database
          const { data: refreshedImages } = await supabase
            .from('images')
            .select('image_id, url, hash, width, height, nsfw')
            .eq('post_id', postId)
            .order('image_id', { ascending: true });

          if (refreshedImages) {
            const updatedImages: CivitaiImage[] = refreshedImages.map(img => ({
              id: img.image_id,
              url: img.url,
              hash: img.hash || '',
              width: img.width || 0,
              height: img.height || 0,
              nsfw: img.nsfw || false,
              postId: postId
            }));
            setImages(updatedImages);
          }
        } else if (apiImageCount === dbImageCount) {
          console.log(`✅ Post ${postId} is up to date (${dbImageCount} images)`);
        }

        // Update the timestamp
        await supabase
          .from('posts')
          .update({ updated_at: new Date().toISOString() })
          .eq('post_id', postId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  // Sort images so cover is always first
  const sortedImages = [...images].sort((a, b) => {
    if (a.url === coverImageUrl) return -1;
    if (b.url === coverImageUrl) return 1;
    return 0;
  });

  // Log sorted images order for debugging when images change
  useEffect(() => {
    if (sortedImages.length > 0) {
      console.log(`📸 PostDetail ${postId} sortedImages (${sortedImages.length} total):`);
      console.log(`   Cover URL: ${coverImageUrl?.substring(0, 60)}...`);
      sortedImages.slice(0, 3).forEach((img, idx) => {
        const isCover = img.url === coverImageUrl;
        console.log(`   [${idx + 1}] ${isCover ? '⭐ ' : '   '}${img.url.substring(0, 60)}... (id: ${img.id})`);
      });
      if (sortedImages.length > 3) {
        console.log(`   ... ${sortedImages.length - 3} more images`);
        const last = sortedImages[sortedImages.length - 1];
        console.log(`   [${sortedImages.length}] ${last.url.substring(0, 60)}... (id: ${last.id})`);
      }
    }
  }, [images.length, coverImageUrl]);

  async function handleSetCover(image: CivitaiImage, e: React.MouseEvent) {
    e.stopPropagation();

    try {
      // Update the database with new cover image
      const { error } = await supabase
        .from('posts')
        .update({
          cover_image_url: image.url,
          cover_image_hash: image.hash,
          updated_at: new Date().toISOString()
        })
        .eq('post_id', postId);

      if (error) throw error;

      // Update local state
      setCoverImageUrl(image.url);

      // Notify parent of cover image change
      onCoverImageChange?.(image.url);
    } catch (err) {
      console.error('Error setting cover image:', err);
      alert('Failed to set cover image: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function handleDeleteImage(image: CivitaiImage, e: React.MouseEvent) {
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete this image?\n\n${image.url.substring(0, 80)}...`
    );

    if (!confirmed) return;

    try {
      // Delete from database
      const { error } = await supabase
        .from('images')
        .delete()
        .eq('image_id', image.id);

      if (error) throw error;

      // Update local state
      setImages(prev => prev.filter(img => img.id !== image.id));

      // Update post image count
      const newCount = images.length - 1;
      await supabase
        .from('posts')
        .update({
          image_count: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('post_id', postId);

      console.log(`✅ Deleted image ${image.id}`);
    } catch (err) {
      console.error('Error deleting image:', err);
      alert('Failed to delete image: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    setDragOverIndex(index);
    // Set a transparent drag image
    const target = e.currentTarget as HTMLElement;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragEnter(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder in real-time as we drag over
    const newImages = [...sortedImages];
    const draggedImage = newImages[draggedIndex];

    // Remove from old position
    newImages.splice(draggedIndex, 1);

    // Insert at new position
    newImages.splice(index, 0, draggedImage);

    // Update state
    setImages(newImages);
    setDraggedIndex(index);
    setDragOverIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault(); // Allow drop
    e.stopPropagation();

    if (draggedIndex === null || draggedIndex === index) return;

    // Reorder in real-time as we drag over
    const newImages = [...sortedImages];
    const draggedImage = newImages[draggedIndex];

    // Remove from old position
    newImages.splice(draggedIndex, 1);

    // Insert at new position
    newImages.splice(index, 0, draggedImage);

    // Update state
    setImages(newImages);
    setDraggedIndex(index);
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  async function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Persist the new order to the database
    try {
      // Update each image with its new position
      const updates = sortedImages.map((image, index) => ({
        image_id: image.id,
        position: index
      }));

      // Update all positions in the database
      for (const update of updates) {
        await supabase
          .from('images')
          .update({ position: update.position })
          .eq('image_id', update.image_id);
      }

      console.log('✅ Image order saved to database');
    } catch (err) {
      console.error('Error saving image order:', err);
      alert('Failed to save image order: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function handleDownloadAll() {
    try {
      setDownloading(true);
      console.log(`📥 Downloading all images for post ${postId}...`);

      const zip = new JSZip();

      // Download each image and add to zip
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        try {
          console.log(`Downloading image ${i + 1}/${images.length}: ${image.url}`);

          // Fetch the image
          const response = await fetch(image.url);
          const blob = await response.blob();

          // Get file extension from URL or blob type
          const urlParts = image.url.split('.');
          const extension = urlParts[urlParts.length - 1].split('?')[0] || 'jpg';

          // Add to zip with image ID as filename (e.g., 12345678.jpg)
          zip.file(`${image.id}.${extension}`, blob);
        } catch (err) {
          console.error(`Failed to download image ${i + 1}:`, err);
        }
      }

      // Generate zip file
      console.log('Generating zip file...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Try to use File System Access API for "Save As" dialog
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: `${postId}.zip`,
            types: [{
              description: 'ZIP Archive',
              accept: { 'application/zip': ['.zip'] }
            }]
          });

          const writable = await handle.createWritable();
          await writable.write(zipBlob);
          await writable.close();

          console.log(`✅ Download complete: ${postId}.zip`);
        } catch (err) {
          // User cancelled or error occurred
          if ((err as Error).name !== 'AbortError') {
            console.error('Error saving file:', err);
            throw err;
          }
        }
      } else {
        // Fallback to traditional download
        console.log('File System Access API not supported, using fallback download');
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${postId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`✅ Download complete: ${postId}.zip (fallback method)`);
      }
    } catch (err) {
      console.error('Error downloading images:', err);
      alert('Failed to download images: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }

  async function handleSyncImages() {
    try {
      setSyncing(true);
      console.log(`🔄 Syncing images for post ${postId}...`);

      // Step 1: Fetch from API
      const apiResponse = await fetch(`https://civitai.com/api/v1/images?postId=${postId}&limit=200&nsfw=true`);
      if (!apiResponse.ok) {
        throw new Error('Failed to fetch from Civitai API');
      }

      const apiData = await apiResponse.json();
      const apiImages = apiData.items || [];
      console.log(`📡 API returned ${apiImages.length} images`);

      // Step 2: Get all existing images from database
      const { data: dbImages, error: fetchError } = await supabase
        .from('images')
        .select('image_id, url, hash')
        .eq('post_id', postId);

      if (fetchError) throw fetchError;

      console.log(`💾 Database has ${dbImages?.length || 0} images`);

      // Step 3: Find duplicates (same URL, different ID)
      const urlToIds = new Map<string, number[]>();
      dbImages?.forEach(img => {
        const ids = urlToIds.get(img.url) || [];
        ids.push(img.image_id);
        urlToIds.set(img.url, ids);
      });

      const duplicateIds: number[] = [];
      urlToIds.forEach((ids, url) => {
        if (ids.length > 1) {
          // Keep the first ID (lowest), mark others for deletion
          const [keep, ...remove] = ids.sort((a, b) => a - b);
          console.log(`🔍 Found ${ids.length} duplicates for URL ${url.substring(0, 50)}... keeping ${keep}`);
          duplicateIds.push(...remove);
        }
      });

      // Step 4: Delete duplicates
      if (duplicateIds.length > 0) {
        console.log(`🗑️  Deleting ${duplicateIds.length} duplicate images`);
        const { error: deleteError } = await supabase
          .from('images')
          .delete()
          .in('image_id', duplicateIds);

        if (deleteError) {
          console.error('Error deleting duplicates:', deleteError);
        }
      }

      // Step 5: Compare with API - find what should be added and removed
      const apiUrls = new Set(apiImages.map((img: any) => img.url));
      const apiIds = new Set(apiImages.map((img: any) => img.id));
      const dbUrls = new Set(dbImages?.map(img => img.url) || []);
      const dbIds = new Set(dbImages?.map(img => img.image_id) || []);

      // Missing: in API but not in DB
      const missingImages = apiImages.filter((img: any) =>
        !dbUrls.has(img.url) && !dbIds.has(img.id)
      );

      // Extra: in DB but not in API (these are scraped images that shouldn't be there)
      const extraImageIds = dbImages?.filter(img =>
        img.hash !== null && !apiUrls.has(img.url) && !apiIds.has(img.image_id)
      ).map(img => img.image_id) || [];

      // Scraped images (null hash): in DB but not in API - keep these
      const scrapedImages = dbImages?.filter(img =>
        img.hash === null && !apiUrls.has(img.url)
      ) || [];

      // Step 6: Remove extra images (images with hash but not in API)
      if (extraImageIds.length > 0) {
        console.log(`🗑️  Removing ${extraImageIds.length} images not in API (not scraped)`);
        const { error: deleteExtraError } = await supabase
          .from('images')
          .delete()
          .in('image_id', extraImageIds);

        if (deleteExtraError) {
          console.error('Error deleting extra images:', deleteExtraError);
        }
      }

      // Step 7: Insert missing images
      if (missingImages.length > 0) {
        console.log(`➕ Adding ${missingImages.length} missing images from API`);
        const imagesToInsert = missingImages.map((img: any) => ({
          image_id: img.id,
          post_id: postId,
          url: img.url,
          hash: img.hash,
          width: img.width,
          height: img.height,
          nsfw: img.nsfw === 'X' || img.nsfw === 'Mature' || img.nsfwLevel >= 4
        }));

        const { error: insertError } = await supabase
          .from('images')
          .insert(imagesToInsert);

        if (insertError) {
          console.error('Error inserting images:', insertError);
          throw insertError;
        }
      }

      // Step 8: Get final count and update post
      const { count: finalCount } = await supabase
        .from('images')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      await supabase
        .from('posts')
        .update({
          image_count: finalCount || 0,
          updated_at: new Date().toISOString()
        })
        .eq('post_id', postId);

      // Step 9: Refresh images in UI
      const { data: refreshedImages } = await supabase
        .from('images')
        .select('image_id, url, hash, width, height, nsfw')
        .eq('post_id', postId)
        .order('image_id', { ascending: true });

      if (refreshedImages) {
        const updatedImages: CivitaiImage[] = refreshedImages.map(img => ({
          id: img.image_id,
          url: img.url,
          hash: img.hash || '',
          width: img.width || 0,
          height: img.height || 0,
          nsfw: img.nsfw || false,
          postId: postId
        }));
        setImages(updatedImages);
      }

      // Build summary message
      const messages = ['✅ Sync complete!', ''];
      if (duplicateIds.length > 0) {
        messages.push(`🗑️  Removed ${duplicateIds.length} duplicate(s)`);
      }
      if (extraImageIds.length > 0) {
        messages.push(`🗑️  Removed ${extraImageIds.length} extra image(s) not in API`);
      }
      if (missingImages.length > 0) {
        messages.push(`➕ Added ${missingImages.length} missing image(s) from API`);
      }
      if (scrapedImages.length > 0) {
        messages.push(`✨ Kept ${scrapedImages.length} scraped image(s) (not in API)`);
      }
      if (duplicateIds.length === 0 && missingImages.length === 0 && extraImageIds.length === 0) {
        messages.push('✨ Everything was already in sync!');
      }
      messages.push('', `📊 Final count: ${finalCount} images`);
      messages.push(`   (API: ${apiImages.length}, Scraped: ${scrapedImages.length})`);

      alert(messages.join('\n'));
    } catch (err) {
      console.error('Error syncing images:', err);
      alert('Failed to sync images: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  }

  console.log(`🎨 Rendering PostDetail - prevPostId: ${prevPostId}, nextPostId: ${nextPostId}, showing nav: ${!!(prevPostId || nextPostId)}`);

  // Swipe handlers for post navigation
  const ENABLE_SWIPE = false; // Temporary flag to disable swipe for testing
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (ENABLE_SWIPE && nextPostId && onNavigatePost) {
        console.log(`👈 Swiped left - navigating to next post: ${nextPostId}`);
        onNavigatePost(nextPostId);
      }
    },
    onSwipedRight: () => {
      if (ENABLE_SWIPE && prevPostId && onNavigatePost) {
        console.log(`👉 Swiped right - navigating to prev post: ${prevPostId}`);
        onNavigatePost(prevPostId);
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
    delta: 50, // minimum swipe distance
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading post...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-xl text-red-600">Error: {error}</div>
        {onBack && (
          <button
            onClick={() => onBack(postId, images.length)}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Feed
          </button>
        )}
      </div>
    );
  }


  if (images.length === 0) {
    // No images and no cover image
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-800 mb-3">No images found</div>
          <div className="text-gray-600 max-w-md">
            This post has no images available.
          </div>
        </div>

        {onBack && (
          <button
            onClick={() => onBack(postId, images.length)}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Feed
          </button>
        )}
      </div>
    );
  }

  return (
    <div {...swipeHandlers} className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        {/* Username */}
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          <button
            onClick={() => creatorName && onCreatorClick?.(creatorName)}
            className="hover:text-red-600 transition-colors"
          >
            @{creatorName}
          </button>
        </h1>

        {/* Post info bar */}
        <div className="flex items-center gap-6 py-3 rounded-lg flex-wrap sm:flex-nowrap">
          {/* Image count pill and Post ID */}
          <div className="flex items-center gap-3">
            <div className="bg-gray-900 text-white px-4 py-2 rounded-full flex items-center">
              <span className="text-sm font-semibold tracking-tight leading-none">
                {images.length} {images.length === 1 ? 'image' : 'images'}
              </span>
            </div>

            {/* Post ID */}
            <div className="hidden sm:flex items-center">
              <span className="text-base font-normal text-gray-900 tracking-tight">Post #{postId}</span>
            </div>
          </div>

          {/* Divider */}
          <span className="hidden sm:block text-3xl text-gray-900 -translate-y-0.5" style={{ fontWeight: 100 }}>|</span>

          {/* Action buttons */}
          <div className="flex items-center gap-4 h-9">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`p-1.5 rounded transition-all ${
                editMode
                  ? 'text-red-600 hover:bg-white'
                  : 'text-gray-900 hover:bg-white'
              }`}
              title={editMode ? "Stop Editing" : "Edit Mode"}
            >
              {editMode ? (
                <PencilOff className="w-5 h-5" />
              ) : (
                <Pencil className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={handleSyncImages}
              disabled={syncing}
              className="p-1.5 rounded text-gray-900 hover:bg-white transition-all disabled:text-gray-400 disabled:cursor-not-allowed"
              title="Sync Images"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleDownloadAll}
              disabled={downloading || images.length === 0}
              className="p-1.5 rounded text-gray-900 hover:bg-white transition-all disabled:text-gray-400 disabled:cursor-not-allowed"
              title="Download All Images"
            >
              <Download className="w-5 h-5" />
            </button>

            <a
              href={`https://civitai.com/posts/${postId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded text-gray-900 hover:bg-white transition-all flex items-center"
              title="View on Civitai"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${
        editMode
          ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {sortedImages.map((image, index) => {
          const isCover = image.url === coverImageUrl;
          const isCoverOnly = image.id === 0; // Cover image placeholder when no real images

          return (
            <div
              key={image.id || `cover-${index}`}
              className={`transition-all duration-200 ease-in-out ${editMode ? 'cursor-move' : 'cursor-pointer'} ${
                draggedIndex === index ? 'opacity-40 scale-95' : ''
              }`}
              onClick={() => {
                if (!editMode) {
                  console.log(`🖱️ Clicked image at index ${index} (id: ${image.id})`);
                  console.log(`   Passing sortedImages array of length ${sortedImages.length}, startIndex: ${index}`);
                  onImageClick?.(sortedImages, index, nextPostId ?? undefined, prevPostId ?? undefined);
                }
              }}
              draggable={editMode}
              onDragStart={(e) => editMode && handleDragStart(e, index)}
              onDragEnter={(e) => editMode && handleDragEnter(e, index)}
              onDragOver={(e) => editMode && handleDragOver(e, index)}
              onDrop={(e) => editMode && handleDrop(e)}
              onDragEnd={() => editMode && handleDragEnd()}
            >
              <div className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 relative ${
                editMode ? 'hover:shadow-xl' : 'hover:shadow-lg'
              }`}>
                {/* Warning Badge for cover-only images */}
                {isCoverOnly && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-1 rounded-md text-xs font-semibold shadow-lg flex items-center gap-1 z-10">
                    <Info size={14} />
                    Cover only
                  </div>
                )}
                <div
                  className="w-full relative bg-white"
                  style={{
                    aspectRatio: image.width && image.height ? `${image.width} / ${image.height}` : 'auto'
                  }}
                >
                  {index < allowedToLoadCount ? (
                    // Only load images up to the allowed count
                    (mediaTypes.get(image.id) || (image.url.endsWith('.mp4') ? 'video' : 'image')) === 'video' ? (
                      <video
                        src={ensureHttps(image.url)}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                          loadedImages.has(image.id) ? 'opacity-100' : 'opacity-0'
                        }`}
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                        onLoadedData={(e) => {
                          const video = e.target as HTMLVideoElement;
                          setActualDimensions(prev => {
                            const newMap = new Map(prev);
                            newMap.set(image.id, { width: video.videoWidth, height: video.videoHeight });
                            return newMap;
                          });
                          setLoadedImages(prev => new Set(prev).add(image.id));
                        }}
                        onError={() => {
                          if (image.url.endsWith('.mp4')) {
                            console.log(`Video failed for image ${image.id}, falling back to image`);
                            setMediaTypes(prev => new Map(prev).set(image.id, 'image'));
                          }
                        }}
                      />
                    ) : (
                      <img
                        src={ensureHttps(image.url)}
                        alt={`Image ${index + 1} from post ${postId}`}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                          loadedImages.has(image.id) ? 'opacity-100' : 'opacity-0'
                        }`}
                        onLoad={(e) => {
                          const img = e.target as HTMLImageElement;
                          setActualDimensions(prev => {
                            const newMap = new Map(prev);
                            newMap.set(image.id, { width: img.naturalWidth, height: img.naturalHeight });
                            return newMap;
                          });
                          setLoadedImages(prev => new Set(prev).add(image.id));
                        }}
                      />
                    )
                  ) : (
                    // Placeholder for images not yet allowed to load
                    <div className="w-full h-full bg-white" />
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      {/* Image number in circle */}
                      <div className="w-5 h-5 rounded-full border border-gray-900 flex items-center justify-center">
                        <span className="text-xs">{index + 1}</span>
                      </div>
                      {/* Dimensions */}
                      <span>
                        {actualDimensions.get(image.id)
                          ? `${actualDimensions.get(image.id)!.width} × ${actualDimensions.get(image.id)!.height}`
                          : `${image.width} × ${image.height}`
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editMode ? (
                        /* Delete button in edit mode */
                        <button
                          onClick={(e) => handleDeleteImage(image, e)}
                          className="p-1 rounded transition-colors text-red-500 hover:text-red-700"
                          title="Delete image"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      ) : (
                        /* Set as Cover button in normal mode */
                        <button
                          onClick={(e) => handleSetCover(image, e)}
                          disabled={isCover}
                          className={`p-1 rounded transition-colors group ${
                            isCover
                              ? 'text-red-600 cursor-default'
                              : 'text-gray-400 hover:text-gray-600'
                          }`}
                          title={isCover ? 'Currently set as cover' : 'Set as cover image'}
                        >
                          <svg
                            className="w-5 h-5"
                            fill={isCover ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                            />
                          </svg>
                          <svg
                            className={`w-5 h-5 absolute inset-0 m-1 opacity-0 transition-opacity ${
                              !isCover && 'group-hover:opacity-100'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Previous/Next Navigation */}
      {(prevPostId || nextPostId) && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => {
              console.log(`⬅️ Prev button clicked - prevPostId: ${prevPostId}`);
              if (prevPostId) {
                onNavigatePost?.(prevPostId);
              }
            }}
            disabled={!prevPostId}
            className="w-32 px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>
          <button
            onClick={() => nextPostId && onNavigatePost?.(nextPostId)}
            disabled={!nextPostId}
            className="w-32 px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Next
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
