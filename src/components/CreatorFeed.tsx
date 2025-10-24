import { useState, useEffect } from 'react';
import { supabase, getUserNSFWPreference } from '../lib/supabase';
import Masonry from 'react-masonry-css';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface PostPreview {
  postId: number;
  coverImageUrl: string;
  imageCount: number;
  isHidden: boolean;
  isFavorited: boolean;
}

interface CreatorFeedProps {
  username: string;
  onPostClick?: (postId: number) => void;
  onBack?: () => void;
  refreshTrigger?: number;
  updatedPostImageCount?: { postId: number; imageCount: number } | null;
}

interface PostCardProps {
  post: PostPreview;
  onPostClick?: (postId: number) => void;
  onToggleFavorite: (postId: number, currentState: boolean, e: React.MouseEvent) => void;
  onToggleHide: (postId: number, e: React.MouseEvent) => void;
}

const PostCard = ({ post, onPostClick, onToggleFavorite, onToggleHide }: PostCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mediaType, setMediaType] = useState<'video' | 'image'>(
    post.coverImageUrl.endsWith('.mp4') ? 'video' : 'image'
  );

  const handleVideoError = () => {
    // If video fails to load and it's an .mp4, try rendering as image instead
    if (post.coverImageUrl.endsWith('.mp4')) {
      console.log(`Video failed for ${post.postId}, falling back to image`);
      setMediaType('image');
    }
  };

  return (
    <article
      className="mb-3"
    >
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative">
        {/* Image count chip */}
        <div className={`absolute top-3 left-3 text-xs font-medium px-3 py-1 rounded-full z-10 ${
          post.imageCount > 15
            ? 'bg-red-600 text-white'
            : post.imageCount > 5
              ? 'bg-white text-black border border-black'
              : 'bg-black text-white'
        }`}>
          {post.imageCount}
        </div>

        {/* Image or Video */}
        <div
          className="cursor-pointer relative bg-gray-100"
          onClick={() => onPostClick?.(post.postId)}
        >
          {/* Loading skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          )}

          {post.coverImageUrl ? (
            mediaType === 'video' ? (
              <video
                src={post.coverImageUrl}
                className="w-full h-auto relative z-10"
                autoPlay
                muted
                loop
                playsInline
                onError={handleVideoError}
              />
            ) : (
              <img
                src={post.coverImageUrl}
                alt={`Post ${post.postId}`}
                className="w-full h-auto relative z-10"
                onLoad={() => setImageLoaded(true)}
                loading="lazy"
              />
            )
          ) : (
            <div className="w-full aspect-square bg-gray-200 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-sm">Post #{post.postId}</p>
                <p className="text-xs mt-1">No image loaded</p>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="p-3 flex items-center justify-end gap-2">
          {/* Icons */}
          <div className="flex items-center gap-2">
            {/* Heart (favorite) */}
            <button
              onClick={(e) => onToggleFavorite(post.postId, post.isFavorited, e)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={post.isFavorited ? "Unfavorite" : "Favorite"}
            >
              <svg
                className={`w-5 h-5 ${post.isFavorited ? 'text-red-600' : ''}`}
                fill={post.isFavorited ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>

            {/* Link out */}
            <a
              href={`https://civitai.com/posts/${post.postId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="View on Civitai"
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
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>

            {/* Hide */}
            <button
              onClick={(e) => onToggleHide(post.postId, e)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Hide post"
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
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export const CreatorFeed = ({ username, onPostClick, onBack, refreshTrigger, updatedPostImageCount }: CreatorFeedProps) => {
  const [posts, setPosts] = useState<PostPreview[]>([]);
  const [totalPostCount, setTotalPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncDate, setLastSyncDate] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [nsfwFilterActive, setNsfwFilterActive] = useState(false);

  // Update post image count when returning from post detail
  useEffect(() => {
    if (updatedPostImageCount) {
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.postId === updatedPostImageCount.postId
            ? { ...post, imageCount: updatedPostImageCount.imageCount }
            : post
        )
      );
    }
  }, [updatedPostImageCount]);

  useEffect(() => {
    fetchCreatorPosts();
  }, [username, refreshTrigger]);

  async function fetchCreatorPosts() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get total count of all posts (including hidden ones)
      const { count: totalCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('creator_username', username)
        .not('cover_image_url', 'is', null);

      setTotalPostCount(totalCount || 0);

      // Get user's NSFW preference
      const showNSFW = await getUserNSFWPreference();
      console.log(`🔞 CreatorFeed - User NSFW preference: ${showNSFW ? 'Show' : 'Hide'}`);

      // Track if NSFW filter is active
      setNsfwFilterActive(!showNSFW);

      // Get posts from database for this creator
      let query = supabase
        .from('posts')
        .select('post_id, cover_image_url, published_at, image_count, updated_at, nsfw')
        .eq('creator_username', username)
        .not('cover_image_url', 'is', null); // Only synced posts

      // Filter NSFW if user preference is off
      if (!showNSFW) {
        console.log(`🚫 CreatorFeed - Filtering out NSFW posts`);
        query = query.eq('nsfw', false);
      } else {
        console.log(`✅ CreatorFeed - Showing all posts including NSFW`);
      }

      query = query.order('post_id', { ascending: false }); // Sort by post_id (higher = newer)

      const { data: postsData, error: postsError } = await query;

      console.log(`📋 CreatorFeed - Fetched ${postsData?.length || 0} posts for @${username}`);
      console.log(`📋 CreatorFeed - Sample NSFW values:`, postsData?.slice(0, 5).map(p => ({ post_id: p.post_id, nsfw: p.nsfw })));
      if (postsError) {
        console.error('❌ CreatorFeed - Error fetching posts:', postsError);
      }

      // Get most recent update date
      if (postsData && postsData.length > 0) {
        const mostRecent = postsData.reduce((latest, post) => {
          const postDate = new Date(post.updated_at || 0);
          const latestDate = new Date(latest);
          return postDate > latestDate ? post.updated_at : latest;
        }, postsData[0].updated_at || '');

        if (mostRecent) {
          const date = new Date(mostRecent);
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          // Check if date is today
          if (date.toDateString() === today.toDateString()) {
            setLastSyncDate('Today');
          }
          // Check if date is yesterday
          else if (date.toDateString() === yesterday.toDateString()) {
            setLastSyncDate('Yesterday');
          }
          // Otherwise use formatted date
          else {
            setLastSyncDate(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
          }
        }
      }

      if (postsError) throw postsError;

      console.log(`📥 Fetched ${postsData?.length || 0} posts for ${username}`);

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      // Get all image counts in one query
      const postIds = postsData.map(p => p.post_id);
      const { data: imageCounts } = await supabase
        .from('images')
        .select('post_id')
        .in('post_id', postIds);

      // Count images per post
      const imageCountMap = new Map<number, number>();
      imageCounts?.forEach(img => {
        imageCountMap.set(img.post_id, (imageCountMap.get(img.post_id) || 0) + 1);
      });

      // Get post interactions (hidden/favorited)
      const { data: interactions } = await supabase
        .from('post_interactions')
        .select('*')
        .eq('user_id', user.id);

      const interactionsMap = new Map(
        interactions?.map(i => [i.post_id, { isHidden: i.is_hidden, isFavorited: i.is_favorited }]) || []
      );

      // Map posts with image counts
      const postsWithCounts = postsData.map((post) => {
        const interaction = interactionsMap.get(post.post_id);
        return {
          postId: post.post_id,
          coverImageUrl: post.cover_image_url,
          imageCount: post.image_count || 0,
          isHidden: interaction?.isHidden || false,
          isFavorited: interaction?.isFavorited || false
        };
      });

      // Filter out hidden posts
      const visiblePosts = postsWithCounts.filter(p => !p.isHidden);

      console.log(`👁️  Visible posts (after filtering hidden): ${visiblePosts.length}`);
      console.log(`🙈 Hidden posts: ${postsWithCounts.length - visiblePosts.length}`);

      setPosts(visiblePosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function toggleHide(postId: number, e: React.MouseEvent) {
    e.stopPropagation();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Remove from feed immediately
      setPosts(prev => prev.filter(p => p.postId !== postId));

      // Update database
      const { data: existing } = await supabase
        .from('post_interactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('post_interactions')
          .update({ is_hidden: true, updated_at: new Date().toISOString() })
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('post_interactions')
          .insert({ post_id: postId, user_id: user.id, is_hidden: true });
      }
    } catch (err) {
      console.error('Error hiding post:', err);
      fetchCreatorPosts();
    }
  }

  async function toggleFavorite(postId: number, currentState: boolean, e: React.MouseEvent) {
    e.stopPropagation();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newState = !currentState;

      // Update UI immediately
      setPosts(prev => prev.map(p =>
        p.postId === postId ? { ...p, isFavorited: newState } : p
      ));

      // Update database
      const { data: existing } = await supabase
        .from('post_interactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('post_interactions')
          .update({ is_favorited: newState, updated_at: new Date().toISOString() })
          .eq('post_id', postId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('post_interactions')
          .insert({ post_id: postId, user_id: user.id, is_favorited: newState });
      }
    } catch (err) {
      console.error('Error favoriting post:', err);
      fetchCreatorPosts();
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      console.log(`🔄 Syncing posts for @${username}...`);

      // First, sync incomplete posts (posts with IDs but no images from extension)
      const { syncIncompletePosts } = await import('../lib/sync');
      console.log(`🔄 Syncing incomplete posts for ${username}...`);
      await syncIncompletePosts(username);

      // Then do regular sync for new posts from API
      const { syncCreator } = await import('../lib/sync');
      await supabase
        .from('creators')
        .update({ sync_status: 'pending' })
        .eq('username', username);

      await syncCreator(username, undefined, { fullBackfill: true });

      // Refresh posts from database
      await fetchCreatorPosts();

      console.log(`✅ Sync complete for @${username}`);
      alert(`Sync completed for ${username}`);
    } catch (err) {
      console.error('Error syncing:', err);
      alert('Failed to sync: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading posts from @{username}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-xl text-red-600">Error: {error}</div>
        {onBack && (
          <button
            onClick={onBack}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Feed
          </button>
        )}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-xl text-gray-600">No posts found for @{username}</div>
        {nsfwFilterActive && (
          <div className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-medium">
            NSFW Filter Active
          </div>
        )}
      </div>
    );
  }

  const breakpointColumns = {
    default: 5,
    1280: 4,
    1024: 3,
    768: 2
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        {/* Username */}
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          @{username}
        </h1>

        {/* Info bar */}
        <div className="flex items-center gap-6 py-3 rounded-lg">
          {/* Post count pill and last sync */}
          <div className="flex items-center gap-3">
            <div className="bg-gray-900 text-white px-4 py-2 rounded-full flex items-center">
              <span className="text-sm font-semibold tracking-tight leading-none">{totalPostCount} posts</span>
            </div>

            {/* Last sync date */}
            {lastSyncDate && (
              <div className="hidden sm:flex items-center">
                <span className="text-base font-normal text-gray-900 tracking-tight">Last synced: {lastSyncDate}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <span className="hidden sm:block text-3xl text-gray-900 -translate-y-0.5" style={{ fontWeight: 100 }}>|</span>

          {/* Action buttons */}
          <div className="flex items-center gap-4 h-9">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="p-1.5 rounded text-gray-900 hover:bg-white transition-all disabled:text-gray-400 disabled:cursor-not-allowed"
              title="Sync Posts"
            >
              <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            </button>

            <a
              href={`https://civitai.com/user/${username}/posts`}
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

      <Masonry
        breakpointCols={breakpointColumns}
        className="flex -ml-3 w-auto"
        columnClassName="pl-3 bg-clip-padding"
      >
        {posts.map((post) => (
          <PostCard
            key={post.postId}
            post={post}
            onPostClick={onPostClick}
            onToggleFavorite={toggleFavorite}
            onToggleHide={toggleHide}
          />
        ))}
      </Masonry>
    </div>
  );
};
