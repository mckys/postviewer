import { useState, useEffect } from 'react';
import { supabase, getUserNSFWPreference } from '../lib/supabase';
import Masonry from 'react-masonry-css';

interface PostPreview {
  postId: number;
  coverImageUrl: string;
  imageCount: number;
  username: string;
  isHidden: boolean;
  isFavorited: boolean;
  coverWidth?: number;
  coverHeight?: number;
}

interface FavoritesProps {
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
        <div className={`absolute top-3 left-3 text-xs font-medium px-3 py-1 rounded-full z-20 ${
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
          style={post.coverWidth && post.coverHeight ? { aspectRatio: `${post.coverWidth} / ${post.coverHeight}` } : undefined}
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
                style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
                autoPlay
                muted
                loop
                playsInline
                onError={handleVideoError}
                onLoadedMetadata={() => setImageLoaded(true)}
              />
            ) : (
              <img
                src={post.coverImageUrl}
                alt={`Post ${post.postId} by ${post.username}`}
                className="w-full h-auto relative z-10"
                style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
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

export const Favorites = ({ onPostClick, onCreatorClick, refreshTrigger, updatedPostImageCount }: FavoritesProps) => {
  const [posts, setPosts] = useState<PostPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    fetchFavorites();
  }, []);

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchFavorites();
    }
  }, [refreshTrigger]);

  async function fetchFavorites() {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get all favorited post IDs for this user
      const { data: favorites, error: favError } = await supabase
        .from('post_interactions')
        .select('post_id')
        .eq('user_id', user.id)
        .eq('is_favorited', true);

      if (favError) throw favError;

      if (!favorites || favorites.length === 0) {
        setPosts([]);
        return;
      }

      const favoritedPostIds = favorites.map(f => f.post_id);

      // Get user's NSFW preference
      const showNSFW = await getUserNSFWPreference();

      // Get posts data for favorited posts
      let query = supabase
        .from('posts')
        .select('post_id, creator_username, cover_image_url, cover_width, cover_height, published_at, image_count, nsfw')
        .in('post_id', favoritedPostIds)
        .not('cover_image_url', 'is', null);

      // Filter NSFW if user preference is off
      if (!showNSFW) {
        query = query.eq('nsfw', false);
      }

      query = query.order('post_id', { ascending: false });

      const { data: postsData, error: postsError } = await query;

      if (postsError) throw postsError;

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

      // Get post interactions for this user
      const { data: interactions } = await supabase
        .from('post_interactions')
        .select('*')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      const interactionsMap = new Map(
        interactions?.map(i => [i.post_id, { isHidden: i.is_hidden, isFavorited: i.is_favorited }]) || []
      );

      // Map posts with image counts
      const postsWithCounts = postsData.map((post) => {
        const interaction = interactionsMap.get(post.post_id);
        return {
          postId: post.post_id,
          coverImageUrl: post.cover_image_url,
          coverWidth: post.cover_width,
          coverHeight: post.cover_height,
          imageCount: post.image_count || 0,
          username: post.creator_username,
          isHidden: interaction?.isHidden || false,
          isFavorited: interaction?.isFavorited || false
        };
      });

      // Filter out hidden posts
      const visiblePosts = postsWithCounts.filter(p => !p.isHidden);

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
      fetchFavorites();
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
      ).filter(p => p.isFavorited)); // Remove unfavorited posts from favorites view

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
      fetchFavorites();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading favorites...</div>
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
        <div className="text-xl text-gray-600">No favorites yet. Click the heart icon on posts to add them here!</div>
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
        {posts.map((post) => (
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
        {posts.length} {posts.length === 1 ? 'favorite' : 'favorites'}
      </div>
    </div>
  );
};
