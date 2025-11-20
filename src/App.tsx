import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Navigation } from './components/Navigation';
import { Feed } from './components/Feed';
import { Settings } from './components/Settings';
import { Favorites } from './components/Favorites';
import { PostDetail } from './components/PostDetail';
import { Slideshow } from './components/Slideshow';
import { CreatorFeed } from './components/CreatorFeed';
import { HiddenPosts } from './components/HiddenPosts';
import { UnclaimedPosts } from './components/UnclaimedPosts';
import { Login } from './components/Login';
import { CivitaiImage } from './lib/civitai';
import { supabase } from './lib/supabase';
import type { User } from '@supabase/supabase-js';

type View = 'feed' | 'myposts' | 'favorites' | 'settings' | 'post-detail' | 'creator-feed' | 'hidden-posts' | 'unclaimed-posts';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('feed');
  const [viewHistory, setViewHistory] = useState<View[]>(['feed']);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [selectedCreatorForBack, setSelectedCreatorForBack] = useState<string | null>(null);
  const [postSourceView, setPostSourceView] = useState<'feed' | 'myposts' | 'favorites' | 'creator-feed'>('feed');
  const [creatorFeedSourceView, setCreatorFeedSourceView] = useState<'feed' | 'myposts' | 'favorites' | 'settings' | 'none'>('feed');
  const [slideshowImages, setSlideshowImages] = useState<CivitaiImage[] | null>(null);
  const [slideshowStartIndex, setSlideshowStartIndex] = useState(0);
  const [scrollPositions, setScrollPositions] = useState<Map<string, number>>(new Map());
  const [shouldRestoreScroll, setShouldRestoreScroll] = useState(false);
  const [feedRefreshTrigger, setFeedRefreshTrigger] = useState(0);
  const [creatorFeedRefreshTrigger, setCreatorFeedRefreshTrigger] = useState(0);
  const [favoritesRefreshTrigger, setFavoritesRefreshTrigger] = useState(0);
  const [updatedPostData, setUpdatedPostData] = useState<{ postId: number; imageCount?: number; coverImageUrl?: string } | null>(null);
  const [shouldRemount, setShouldRemount] = useState(true);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  // Handler for when favorites/interactions change in any feed
  const handlePostInteractionChange = (sourceView: 'feed' | 'creator' | 'favorites') => {
    // Trigger refresh for all OTHER feeds (not the source)
    if (sourceView !== 'feed') setFeedRefreshTrigger(prev => prev + 1);
    if (sourceView !== 'creator') setCreatorFeedRefreshTrigger(prev => prev + 1);
    if (sourceView !== 'favorites') setFavoritesRefreshTrigger(prev => prev + 1);
  };

  // Fetch user's username from settings
  useEffect(() => {
    if (user) {
      supabase
        .from('user_settings')
        .select('civitai_username')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setMyUsername(data?.civitai_username || null);
        });
    }
  }, [user]);

  // Check for existing auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Start background sync when user is logged in
      if (session?.user) {
        startBackgroundSync();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      // Start background sync when user logs in
      if (session?.user) {
        startBackgroundSync();
      }
    });

    // Listen for manual sync trigger from Settings
    const handleTriggerSync = () => {
      console.log('🔄 Manual sync triggered from Settings...');
      startBackgroundSync();
    };

    window.addEventListener('triggerSync', handleTriggerSync);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('triggerSync', handleTriggerSync);
    };
  }, []);

  // Background sync - check for stale creators and sync them
  const startBackgroundSync = async () => {
    try {
      console.log('🔍 Checking if sync is needed...');
      const { needsSync, syncAllCreators } = await import('./lib/sync');

      // Check if any creators need syncing
      const shouldSync = await needsSync();
      console.log(`   needsSync returned: ${shouldSync}`);

      if (shouldSync) {
        console.log('🔄 Starting background sync for stale creators...');
        // Run sync in background without blocking UI
        syncAllCreators().then(() => {
          console.log('✅ Background sync completed');
          // Trigger refresh of feeds - but don't interrupt active viewing
          // Only refresh if user is not currently viewing that specific feed
          setFeedRefreshTrigger((prev: number) => prev + 1);
          // Don't refresh creator feed if user is actively viewing it
          if (currentView !== 'creator-feed' && currentView !== 'myposts') {
            setCreatorFeedRefreshTrigger((prev: number) => prev + 1);
          }
          setFavoritesRefreshTrigger((prev: number) => prev + 1);
          // Dispatch event for Settings to refresh stats
          window.dispatchEvent(new Event('syncCompleted'));
        }).catch(err => {
          console.error('❌ Background sync failed:', err);
        });
      } else {
        console.log('✅ All creators are up to date (synced within last 24 hours)');
      }
    } catch (err) {
      console.error('Error checking sync status:', err);
    }
  };

  // Restore scroll position when returning to a view (use layoutEffect to run before paint)
  useLayoutEffect(() => {
    if (shouldRestoreScroll) {
      const savedPosition = scrollPositions.get(currentView) || 0;
      // Use requestAnimationFrame to ensure DOM is fully rendered
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
        setShouldRestoreScroll(false);
      });
    }
  }, [currentView, shouldRestoreScroll, scrollPositions]);

  const handlePostClick = async (postId: number) => {
    // Save current scroll position
    const scrollY = window.scrollY;
    setScrollPositions(prev => new Map(prev).set(currentView, scrollY));

    setViewHistory([...viewHistory, currentView]);
    setSelectedCreatorForBack(selectedCreator);
    setSelectedPostId(postId);

    // Track which view the post was opened from
    if (currentView === 'creator-feed') {
      // Use the creatorFeedSourceView which already knows if it's myposts or none
      if (creatorFeedSourceView === 'myposts') {
        setPostSourceView('myposts');
      } else {
        setPostSourceView('creator-feed');
      }
    } else if (currentView === 'myposts') {
      setPostSourceView('myposts');
    } else if (currentView === 'favorites') {
      setPostSourceView('favorites');
    } else {
      setPostSourceView('feed');
    }

    setCurrentView('post-detail');

    // Scroll to top when opening a post
    window.scrollTo(0, 0);
  };

  const handleNavigatePost = (postId: number) => {
    setSelectedPostId(postId);
    // Scroll to top when navigating to a different post
    window.scrollTo(0, 0);
  };

  const handleCreatorClick = async (username: string) => {
    setViewHistory([...viewHistory, currentView]);
    setSelectedCreator(username);

    // Check if this is the user's own username
    const { data: { user } } = await supabase.auth.getUser();
    let myUsername: string | undefined = undefined;

    if (user) {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('civitai_username')
        .eq('user_id', user.id)
        .maybeSingle();

      myUsername = userSettings?.civitai_username;
    }

    // Simple logic: myposts if own username, otherwise no active icon
    if (myUsername && username === myUsername) {
      setCreatorFeedSourceView('myposts');
    } else {
      setCreatorFeedSourceView('none'); // No icon active for other creators
    }

    setCurrentView('creator-feed');

    // Scroll to top when opening creator feed
    window.scrollTo(0, 0);
  };

  // Track current post image count for updates
  const [currentPostImageCount, setCurrentPostImageCount] = useState<number | null>(null);
  const [currentPostCoverUrl, setCurrentPostCoverUrl] = useState<string | null>(null);

  const handleBackToFeed = (postId?: number, imageCount?: number, coverImageUrl?: string) => {
    const previousView = viewHistory[viewHistory.length - 1] || 'feed';
    setViewHistory(viewHistory.slice(0, -1));

    // Use provided values or fallback to tracked values
    const finalPostId = postId ?? selectedPostId;
    const finalImageCount = imageCount ?? currentPostImageCount;
    const finalCoverUrl = coverImageUrl ?? currentPostCoverUrl;

    // Store the updated data if we have any changes
    if (finalPostId !== null && (finalImageCount !== null || finalCoverUrl !== null)) {
      setUpdatedPostData({
        postId: finalPostId,
        imageCount: finalImageCount ?? undefined,
        coverImageUrl: finalCoverUrl ?? undefined
      });
    }

    // Don't remount when using back button
    setShouldRemount(false);

    if (previousView === 'creator-feed' && selectedCreatorForBack) {
      setCurrentView('creator-feed');
      setSelectedCreator(selectedCreatorForBack);
      setSelectedPostId(null);
    } else {
      setCurrentView(previousView === 'post-detail' || previousView === 'creator-feed' ? 'feed' : previousView);
      setSelectedPostId(null);
      setSelectedCreator(null);
      setSelectedCreatorForBack(null);
    }

    // Clear tracked data
    setCurrentPostImageCount(null);
    setCurrentPostCoverUrl(null);

    // Trigger scroll restoration
    setShouldRestoreScroll(true);
  };

  const [slideshowNextPostId, setSlideshowNextPostId] = useState<number | null>(null);
  const slideshowNextPostIdRef = useRef<number | null>(null);
  const [slideshowPrevPostId, setSlideshowPrevPostId] = useState<number | null>(null);
  const slideshowPrevPostIdRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    slideshowNextPostIdRef.current = slideshowNextPostId;
  }, [slideshowNextPostId]);

  useEffect(() => {
    slideshowPrevPostIdRef.current = slideshowPrevPostId;
  }, [slideshowPrevPostId]);

  const handleImageClick = (images: CivitaiImage[], startIndex: number, nextPostId?: number, prevPostId?: number) => {
    console.log(`📥 handleImageClick received:`);
    console.log(`   ${images.length} images, startIndex: ${startIndex}`);
    images.forEach((img, idx) => {
      console.log(`   [${idx}] ${img.url.substring(0, 60)}... (id: ${img.id})`);
    });

    // Save scroll position before opening slideshow
    setScrollPositions(prev => new Map(prev).set('post-detail', window.scrollY));
    setSlideshowImages(images);
    setSlideshowStartIndex(startIndex);
    setSlideshowNextPostId(nextPostId ?? null);
    setSlideshowPrevPostId(prevPostId ?? null);
  };

  const handleSlideshowNavigateNext = useCallback(async () => {
    const nextPostId = slideshowNextPostIdRef.current;
    if (!nextPostId) return;

    // Navigate the post in the background
    handleNavigatePost(nextPostId);

    // Fetch the next post's images for the slideshow
    try {
      // First get the post to find the cover image
      const { data: postData } = await supabase
        .from('posts')
        .select('cover_image_url')
        .eq('post_id', nextPostId)
        .single();

      const { data: imageData, error } = await supabase
        .from('images')
        .select('image_id, url, nsfw, width, height, hash, post_id, created_at')
        .eq('post_id', nextPostId)
        .order('position', { ascending: true, nullsFirst: false })
        .order('image_id', { ascending: true });

      if (error) throw error;

      // Create images array - use DB images if available, otherwise use cover as placeholder
      let images: CivitaiImage[] = [];

      if (imageData && imageData.length > 0) {
        images = imageData.map(img => ({
          id: img.image_id,
          url: img.url,
          nsfw: img.nsfw,
          width: img.width,
          height: img.height,
          hash: img.hash,
          postId: img.post_id,
          createdAt: img.created_at
        }));
        console.log(`➡️ Slideshow navigating to next post ${nextPostId}: ${images.length} DB images`);
      } else if (postData?.cover_image_url) {
        // No images in DB but we have a cover - use it as placeholder (cover-only post)
        images = [{
          id: 0,
          url: postData.cover_image_url,
          nsfw: false,
          width: 0,
          height: 0,
          hash: '',
          postId: nextPostId
        }];
        console.log(`➡️ Slideshow navigating to cover-only post ${nextPostId}: cover=${postData.cover_image_url.substring(0, 60)}...`);
      } else {
        console.warn(`⚠️ Post ${nextPostId} has no images and no cover_image_url`);
      }

      if (images.length > 0) {
        // Sort images so cover is always first (matching PostDetail behavior)
        const coverImageUrl = postData?.cover_image_url;
        const sortedImages = [...images].sort((a, b) => {
          if (a.url === coverImageUrl) return -1;
          if (b.url === coverImageUrl) return 1;
          return 0;
        });

        // Update slideshow images and reset to first image
        setSlideshowImages(sortedImages);
        setSlideshowStartIndex(0);
        console.log(`➡️ Final sorted images: ${sortedImages.length}, starting at first image (index 0)`);

        // Fetch the next-next post ID based on source view context
        let nextQuery = supabase.from('posts').select('post_id');

        // Check if we came from a specific creator's page (selectedCreatorForBack is set)
        if (selectedCreatorForBack) {
          nextQuery = nextQuery.eq('creator_username', selectedCreatorForBack);
        } else if (postSourceView === 'myposts') {
          // MyPosts tab (not from creator page)
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              nextQuery = nextQuery.eq('creator_username', myUsername);
            }
          }
        } else if (postSourceView === 'favorites') {
          const { data: favInteractions } = await supabase
            .from('post_interactions')
            .select('post_id')
            .eq('is_favorited', true);

          const favPostIds = favInteractions?.map(i => i.post_id) || [];
          if (favPostIds.length > 0) {
            nextQuery = nextQuery.in('post_id', favPostIds);
          } else {
            setSlideshowNextPostId(null);
            return;
          }
        } else if (postSourceView === 'feed') {
          // Get user's followed creators
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: myCreators } = await supabase
              .from('creators')
              .select('username')
              .eq('user_id', currentUser.id);

            const creatorUsernames = myCreators?.map(c => c.username) || [];

            if (creatorUsernames.length === 0) {
              setSlideshowNextPostId(null);
              return;
            }

            // Filter by followed creators
            nextQuery = nextQuery.in('creator_username', creatorUsernames);

            // Exclude user's own posts if username is set
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              nextQuery = nextQuery.neq('creator_username', myUsername);
            }
          }
        }

        const { data: nextPostData } = await nextQuery
          .lt('post_id', nextPostId)
          .not('cover_image_url', 'is', null)
          .order('post_id', { ascending: false })
          .limit(1)
          .maybeSingle();

        setSlideshowNextPostId(nextPostData?.post_id ?? null);

        // Also fetch the previous post ID from the new current post (nextPostId)
        let newPrevQuery = supabase.from('posts').select('post_id');

        // Apply same filters as nextQuery
        if (selectedCreatorForBack) {
          newPrevQuery = newPrevQuery.eq('creator_username', selectedCreatorForBack);
        } else if (postSourceView === 'myposts') {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              newPrevQuery = newPrevQuery.eq('creator_username', myUsername);
            }
          }
        } else if (postSourceView === 'favorites') {
          const { data: favInteractions } = await supabase
            .from('post_interactions')
            .select('post_id')
            .eq('is_favorited', true);

          const favPostIds = favInteractions?.map(i => i.post_id) || [];
          if (favPostIds.length > 0) {
            newPrevQuery = newPrevQuery.in('post_id', favPostIds);
          }
        } else if (postSourceView === 'feed') {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: myCreators } = await supabase
              .from('creators')
              .select('username')
              .eq('user_id', currentUser.id);

            const creatorUsernames = myCreators?.map(c => c.username) || [];
            if (creatorUsernames.length > 0) {
              newPrevQuery = newPrevQuery.in('creator_username', creatorUsernames);
            }

            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              newPrevQuery = newPrevQuery.neq('creator_username', myUsername);
            }
          }
        }

        const { data: prevPostData } = await newPrevQuery
          .gt('post_id', nextPostId)
          .not('cover_image_url', 'is', null)
          .order('post_id', { ascending: true })
          .limit(1)
          .maybeSingle();

        setSlideshowPrevPostId(prevPostData?.post_id ?? null);
        console.log(`   Updated slideshow navigation - prev: ${prevPostData?.post_id ?? null}, next: ${nextPostData?.post_id ?? null}`);
      }
    } catch (err) {
      console.error('Error fetching next post images:', err);
    }
  }, [postSourceView, selectedCreatorForBack, handleNavigatePost]);

  const handleSlideshowNavigatePrevious = useCallback(async () => {
    const prevPostId = slideshowPrevPostIdRef.current;
    console.log(`🔙 handleSlideshowNavigatePrevious called - prevPostId: ${prevPostId}`);
    if (!prevPostId) {
      console.log(`❌ No prevPostId available, cannot navigate`);
      return;
    }

    // Navigate the post in the background
    handleNavigatePost(prevPostId);

    // Fetch the previous post's images for the slideshow
    try {
      // First get the post to find the cover image
      const { data: postData } = await supabase
        .from('posts')
        .select('cover_image_url')
        .eq('post_id', prevPostId)
        .single();

      const { data: imageData, error } = await supabase
        .from('images')
        .select('image_id, url, nsfw, width, height, hash, post_id, created_at')
        .eq('post_id', prevPostId)
        .order('position', { ascending: true, nullsFirst: false })
        .order('image_id', { ascending: true });

      if (error) throw error;

      // Create images array - use DB images if available, otherwise use cover as placeholder
      let images: CivitaiImage[] = [];

      if (imageData && imageData.length > 0) {
        images = imageData.map(img => ({
          id: img.image_id,
          url: img.url,
          nsfw: img.nsfw,
          width: img.width,
          height: img.height,
          hash: img.hash,
          postId: img.post_id,
          createdAt: img.created_at
        }));
        console.log(`⬅️ Slideshow navigating to prev post ${prevPostId}: ${images.length} DB images`);
      } else if (postData?.cover_image_url) {
        // No images in DB but we have a cover - use it as placeholder (cover-only post)
        images = [{
          id: 0,
          url: postData.cover_image_url,
          nsfw: false,
          width: 0,
          height: 0,
          hash: '',
          postId: prevPostId
        }];
        console.log(`⬅️ Slideshow navigating to cover-only prev post ${prevPostId}: cover=${postData.cover_image_url.substring(0, 60)}...`);
      } else {
        console.warn(`⚠️ Prev post ${prevPostId} has no images and no cover_image_url`);
      }

      if (images.length > 0) {
        // Sort images so cover is always first (matching PostDetail behavior)
        const coverImageUrl = postData?.cover_image_url;
        const sortedImages = [...images].sort((a, b) => {
          if (a.url === coverImageUrl) return -1;
          if (b.url === coverImageUrl) return 1;
          return 0;
        });

        console.log(`⬅️ Final sorted images: ${sortedImages.length}, starting at last image (index ${sortedImages.length - 1})`);

        // Update slideshow images and start at last image
        setSlideshowImages(sortedImages);
        setSlideshowStartIndex(sortedImages.length - 1);

        // Fetch the prev-prev post ID based on source view context
        let prevQuery = supabase.from('posts').select('post_id');

        // Check if we came from a specific creator's page (selectedCreatorForBack is set)
        if (selectedCreatorForBack) {
          prevQuery = prevQuery.eq('creator_username', selectedCreatorForBack);
        } else if (postSourceView === 'myposts') {
          // MyPosts tab (not from creator page)
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              prevQuery = prevQuery.eq('creator_username', myUsername);
            }
          }
        } else if (postSourceView === 'favorites') {
          const { data: favInteractions } = await supabase
            .from('post_interactions')
            .select('post_id')
            .eq('is_favorited', true);

          const favPostIds = favInteractions?.map(i => i.post_id) || [];
          if (favPostIds.length > 0) {
            prevQuery = prevQuery.in('post_id', favPostIds);
          } else {
            setSlideshowPrevPostId(null);
            return;
          }
        } else if (postSourceView === 'feed') {
          // Get user's followed creators
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: myCreators } = await supabase
              .from('creators')
              .select('username')
              .eq('user_id', currentUser.id);

            const creatorUsernames = myCreators?.map(c => c.username) || [];

            if (creatorUsernames.length === 0) {
              setSlideshowPrevPostId(null);
              return;
            }

            // Filter by followed creators
            prevQuery = prevQuery.in('creator_username', creatorUsernames);

            // Exclude user's own posts if username is set
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              prevQuery = prevQuery.neq('creator_username', myUsername);
            }
          }
        }

        const { data: prevPostData } = await prevQuery
          .gt('post_id', prevPostId)
          .not('cover_image_url', 'is', null)
          .order('post_id', { ascending: true })
          .limit(1)
          .maybeSingle();

        setSlideshowPrevPostId(prevPostData?.post_id ?? null);

        // Also fetch the next post ID from the new current post (prevPostId)
        let newNextQuery = supabase.from('posts').select('post_id');

        // Apply same filters as prevQuery
        if (selectedCreatorForBack) {
          newNextQuery = newNextQuery.eq('creator_username', selectedCreatorForBack);
        } else if (postSourceView === 'myposts') {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              newNextQuery = newNextQuery.eq('creator_username', myUsername);
            }
          }
        } else if (postSourceView === 'favorites') {
          const { data: favInteractions } = await supabase
            .from('post_interactions')
            .select('post_id')
            .eq('is_favorited', true);

          const favPostIds = favInteractions?.map(i => i.post_id) || [];
          if (favPostIds.length > 0) {
            newNextQuery = newNextQuery.in('post_id', favPostIds);
          }
        } else if (postSourceView === 'feed') {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            const { data: myCreators } = await supabase
              .from('creators')
              .select('username')
              .eq('user_id', currentUser.id);

            const creatorUsernames = myCreators?.map(c => c.username) || [];
            if (creatorUsernames.length > 0) {
              newNextQuery = newNextQuery.in('creator_username', creatorUsernames);
            }

            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('civitai_username')
              .eq('user_id', currentUser.id)
              .maybeSingle();

            const myUsername = userSettings?.civitai_username;
            if (myUsername) {
              newNextQuery = newNextQuery.neq('creator_username', myUsername);
            }
          }
        }

        const { data: nextPostData } = await newNextQuery
          .lt('post_id', prevPostId)
          .not('cover_image_url', 'is', null)
          .order('post_id', { ascending: false })
          .limit(1)
          .maybeSingle();

        setSlideshowNextPostId(nextPostData?.post_id ?? null);
        console.log(`   Updated slideshow navigation - prev: ${prevPostData?.post_id ?? null}, next: ${nextPostData?.post_id ?? null}`);
      }
    } catch (err) {
      console.error('Error fetching previous post images:', err);
    }
  }, [postSourceView, selectedCreatorForBack, handleNavigatePost]);

  const handleCloseSlideshow = () => {
    setSlideshowImages(null);
    // Restore scroll position after closing slideshow
    setTimeout(() => {
      const savedPosition = scrollPositions.get('post-detail') || 0;
      window.scrollTo(0, savedPosition);
    }, 100);
  };

  const handleNavChange = (view: 'feed' | 'myposts' | 'favorites' | 'settings') => {
    setCurrentView(view);
    setSelectedPostId(null);
    setSelectedCreator(null);
    setSelectedCreatorForBack(null);
    setViewHistory([view]);

    // Scroll to top when changing nav views
    window.scrollTo(0, 0);

    // Don't remount when switching between tabs - only remount when clicking same tab
    setShouldRemount(false);
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        currentView={
          currentView === 'post-detail'
            ? (postSourceView === 'creator-feed'
                ? creatorFeedSourceView
                : (postSourceView as 'feed' | 'myposts' | 'favorites' | 'settings' | 'none'))
            : currentView === 'creator-feed'
              ? creatorFeedSourceView
              : (currentView as 'feed' | 'myposts' | 'favorites' | 'settings')
        }
        onViewChange={handleNavChange}
        showBackButton={currentView === 'post-detail' || currentView === 'creator-feed'}
        onBack={handleBackToFeed}
      />

      <div style={{ display: currentView === 'feed' ? 'block' : 'none' }} key={shouldRemount && currentView === 'feed' ? `feed-${feedRefreshTrigger}` : 'feed-persistent'}>
        <Feed
          onPostClick={handlePostClick}
          onCreatorClick={handleCreatorClick}
          refreshTrigger={feedRefreshTrigger}
          updatedPostData={updatedPostData}
          onPostInteractionChange={() => handlePostInteractionChange('feed')}
        />
      </div>
      <div style={{ display: currentView === 'myposts' ? 'block' : 'none' }} key={shouldRemount && currentView === 'myposts' ? `myposts-${creatorFeedRefreshTrigger}` : 'myposts-persistent'}>
        {myUsername && (
          <CreatorFeed
            username={myUsername}
            onPostClick={handlePostClick}
            refreshTrigger={creatorFeedRefreshTrigger}
            updatedPostData={updatedPostData}
            onPostInteractionChange={() => handlePostInteractionChange('creator')}
          />
        )}
      </div>
      <div style={{ display: currentView === 'favorites' ? 'block' : 'none' }} key={shouldRemount && currentView === 'favorites' ? `favorites-${favoritesRefreshTrigger}` : 'favorites-persistent'}>
        <Favorites
          onPostClick={handlePostClick}
          onCreatorClick={handleCreatorClick}
          refreshTrigger={favoritesRefreshTrigger}
          updatedPostData={updatedPostData}
          onPostInteractionChange={() => handlePostInteractionChange('favorites')}
        />
      </div>
      <div style={{ display: currentView === 'settings' ? 'block' : 'none' }}>
        <Settings
          onCreatorClick={handleCreatorClick}
          onViewHidden={() => setCurrentView('hidden-posts')}
          onViewUnclaimed={() => setCurrentView('unclaimed-posts')}
          onNSFWToggle={() => {
            setFeedRefreshTrigger(prev => prev + 1);
            setCreatorFeedRefreshTrigger(prev => prev + 1);
            setFavoritesRefreshTrigger(prev => prev + 1);
          }}
        />
      </div>
      <div style={{ display: currentView === 'hidden-posts' ? 'block' : 'none' }}>
        {currentView === 'hidden-posts' && (
          <HiddenPosts
            onPostClick={handlePostClick}
            onCreatorClick={handleCreatorClick}
          />
        )}
      </div>
      <div style={{ display: currentView === 'unclaimed-posts' ? 'block' : 'none' }}>
        {currentView === 'unclaimed-posts' && (
          <UnclaimedPosts
            onPostClick={handlePostClick}
            onCreatorClick={handleCreatorClick}
          />
        )}
      </div>
      <div style={{ display: currentView === 'creator-feed' ? 'block' : 'none' }}>
        {selectedCreator && (
          <CreatorFeed
            username={selectedCreator}
            onPostClick={handlePostClick}
            onBack={handleBackToFeed}
            refreshTrigger={creatorFeedRefreshTrigger}
            updatedPostData={updatedPostData}
            onPostInteractionChange={() => handlePostInteractionChange('creator')}
          />
        )}
      </div>
      {currentView === 'post-detail' && selectedPostId && (
        <PostDetail
          postId={selectedPostId}
          onImageClick={handleImageClick}
          onBack={handleBackToFeed}
          onNavigatePost={handleNavigatePost}
          onCreatorClick={handleCreatorClick}
          sourceView={postSourceView}
          creatorUsername={postSourceView === 'creator-feed' ? selectedCreatorForBack || undefined : undefined}
          onImageCountChange={setCurrentPostImageCount}
          onCoverImageChange={setCurrentPostCoverUrl}
        />
      )}

      {slideshowImages && (
        <Slideshow
          images={slideshowImages}
          startIndex={slideshowStartIndex}
          onClose={handleCloseSlideshow}
          onNavigateNext={handleSlideshowNavigateNext}
          onNavigatePrevious={handleSlideshowNavigatePrevious}
        />
      )}
    </div>
  );
}

export default App;
