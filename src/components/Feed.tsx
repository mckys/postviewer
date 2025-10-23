import { useState, useEffect } from 'react';
import { supabase, getUserNSFWPreference } from '../lib/supabase';
import Masonry from 'react-masonry-css';
import { ArrowUp } from 'lucide-react';

interface PostPreview {
  postId: number;
  coverImageUrl: string;
  imageCount: number;
  username: string;
  isHidden: boolean;
  isFavorited: boolean;
}

interface FeedProps {
  onPostClick?: (postId: number) => void;
  onCreatorClick?: (username: string) => void;
  refreshTrigger?: number;
  updatedPostImageCount?: { postId: number; imageCount: number } | null;
}

interface PostCardProps {
  post: PostPreview;
  onPostClick?: (postId: number) => void;
  onCreatorClick?: (username: string) => void;
  onToggleFavorite: (postId: number, currentState: boolean, e: React.MouseEvent) => void;
  onToggleHide: (postId: number, e: React.MouseEvent) => void;
}

const PostCard = ({ post, onPostClick, onCreatorClick, onToggleFavorite, onToggleHide }: PostCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mediaType, setMediaType] = useState<'video' | 'image'>(
    post.coverImageUrl.endsWith('.mp4') ? 'video' : 'image'
  );
  const [videoFailed, setVideoFailed] = useState(false);

  const handleVideoError = () => {
    // If video fails to load and it's an .mp4, try rendering as image instead
    if (post.coverImageUrl.endsWith('.mp4') && !videoFailed) {
      console.log(`Video failed for ${post.postId}, falling back to image`);
      setVideoFailed(true);
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
          className="cursor-pointer"
          onClick={() => onPostClick?.(post.postId)}
        >
          {post.coverImageUrl ? (
            mediaType === 'video' ? (
              <video
                src={post.coverImageUrl}
                className="w-full h-auto"
                autoPlay
                muted
                loop
                playsInline
                onError={handleVideoError}
              />
            ) : (
              <img
                src={post.coverImageUrl}
                alt={`Post ${post.postId} by ${post.username}`}
                className={`w-full h-auto transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
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
        <div className="p-2 flex items-center justify-between gap-1">
          {/* Creator name */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreatorClick?.(post.username);
            }}
            className="text-xs font-medium text-gray-900 hover:text-red-600 transition-colors truncate min-w-0 flex-1 text-left"
          >
            @{post.username}
          </button>

          {/* Icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
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

export const Feed = ({ onPostClick, onCreatorClick, refreshTrigger, updatedPostImageCount }: FeedProps) => {
  const [posts, setPosts] = useState<PostPreview[]>([]);
  const [displayedPosts, setDisplayedPosts] = useState<PostPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Update post image count when returning from post detail
  useEffect(() => {
    if (updatedPostImageCount) {
      console.log(`📝 Feed received updatedPostImageCount:`, updatedPostImageCount);
      setPosts(prevPosts => {
        const updated = prevPosts.map(post =>
          post.postId === updatedPostImageCount.postId
            ? { ...post, imageCount: updatedPostImageCount.imageCount }
            : post
        );
        const targetPost = updated.find(p => p.postId === updatedPostImageCount.postId);
        console.log(`📝 Updated post ${updatedPostImageCount.postId} count to ${targetPost?.imageCount}`);
        return updated;
      });
    }
  }, [updatedPostImageCount]);
  const POSTS_PER_PAGE = 50;

  useEffect(() => {
    fetchFeed();
  }, []);

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchFeed();
    }
  }, [refreshTrigger]);

  useEffect(() => {
    // Update displayed posts when page changes
    setDisplayedPosts(posts.slice(0, page * POSTS_PER_PAGE));
  }, [posts, page]);

  useEffect(() => {
    // Infinite scroll and back-to-top button handler
    const handleScroll = () => {
      // Show back-to-top button after scrolling 800px
      setShowBackToTop(window.scrollY > 800);

      // Infinite scroll: load more posts near bottom
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        if (page * POSTS_PER_PAGE < posts.length) {
          setPage(prev => prev + 1);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [page, posts.length]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  async function fetchFeed() {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get my username to exclude from feed
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('civitai_username')
        .eq('user_id', user.id)
        .maybeSingle();

      const myUsername = userSettings?.civitai_username;
      console.log(`👤 My username from database: ${myUsername || '(not set)'}`);

      // Get my creators (only show posts from creators I follow)
      const { data: myCreators } = await supabase
        .from('creators')
        .select('username')
        .eq('user_id', user.id);

      const creatorUsernames = myCreators?.map(c => c.username) || [];

      if (creatorUsernames.length === 0) {
        console.log('⚠️ No creators found - feed will be empty');
        setPosts([]);
        setLoading(false);
        return;
      }

      // Get user's NSFW preference
      const showNSFW = await getUserNSFWPreference();
      console.log(`🔞 User NSFW preference: ${showNSFW ? 'Show' : 'Hide'}`);

      // Get posts only from my creators
      let query = supabase
        .from('posts')
        .select('post_id, creator_username, cover_image_url, published_at, image_count, nsfw')
        .not('cover_image_url', 'is', null) // Only synced posts
        .in('creator_username', creatorUsernames); // Only my creators

      // Filter NSFW if user preference is off
      if (!showNSFW) {
        query = query.eq('nsfw', false);
        console.log(`🚫 Filtering out NSFW posts`);
      }

      query = query.order('post_id', { ascending: false }); // Sort by post_id (higher = newer)

      // Exclude my posts if username is set
      if (myUsername) {
        query = query.neq('creator_username', myUsername);
        console.log(`🚫 Excluding posts from ${myUsername}`);
      }

      const { data: postsData, error: postsError } = await query;

      if (postsError) throw postsError;

      console.log('📥 Feed - Fetched posts:', postsData?.length || 0);
      console.log('📥 Feed - Sample NSFW values:', postsData?.slice(0, 5).map(p => ({ post_id: p.post_id, creator: p.creator_username, nsfw: p.nsfw })));

      if (!postsData || postsData.length === 0) {
        console.log('⚠️ No posts found');
        setPosts([]);
        return;
      }

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
          username: post.creator_username,
          isHidden: interaction?.isHidden || false,
          isFavorited: interaction?.isFavorited || false
        };
      });

      // Filter out hidden posts
      const visiblePosts = postsWithCounts.filter(p => !p.isHidden);

      console.log('✅ Setting posts:', visiblePosts.length);
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
          .insert({ post_id: postId, is_hidden: true, user_id: user.id });
      }
    } catch (err) {
      console.error('Error hiding post:', err);
      // Refresh feed on error
      fetchFeed();
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
          .insert({ post_id: postId, is_favorited: newState, user_id: user.id });
      }
    } catch (err) {
      console.error('Error favoriting post:', err);
      // Revert on error
      fetchFeed();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading feed...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">No posts found. Add some creators to see their posts!</div>
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
      <Masonry
        breakpointCols={breakpointColumns}
        className="flex -ml-3 w-auto"
        columnClassName="pl-3 bg-clip-padding"
      >
        {displayedPosts.map((post) => (
          <PostCard
            key={`${post.postId}-${post.username}`}
            post={post}
            onPostClick={onPostClick}
            onCreatorClick={onCreatorClick}
            onToggleFavorite={toggleFavorite}
            onToggleHide={toggleHide}
          />
        ))}
      </Masonry>
      <div className="mt-8 text-center text-gray-600">
        Showing {displayedPosts.length} of {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        {displayedPosts.length < posts.length && (
          <div className="mt-4 text-sm text-gray-500">Scroll down to load more...</div>
        )}
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors z-50"
          title="Back to top"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};
