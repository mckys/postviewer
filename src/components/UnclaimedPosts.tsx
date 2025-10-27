import { useState, useEffect } from 'react';
import { supabase, ensureHttps } from '../lib/supabase';
import Masonry from 'react-masonry-css';

interface Post {
  post_id: number;
  creator_username: string;
  cover_image_url: string;
  cover_width?: number;
  cover_height?: number;
  image_count: number;
  nsfw: boolean;
  published_at: string;
  is_favorited?: boolean;
}

interface UnclaimedPostsProps {
  onPostClick?: (postId: number) => void;
  onCreatorClick?: (username: string) => void;
}

interface PostCardProps {
  post: Post;
  onPostClick?: (postId: number) => void;
  onCreatorClick?: (username: string) => void;
  onToggleFavorite: (postId: number, currentState: boolean, e: React.MouseEvent) => void;
  onAddToMisc: (creatorUsername: string, postId: number, e: React.MouseEvent) => void;
  isAdding: boolean;
}

const PostCard = ({ post, onPostClick, onCreatorClick, onToggleFavorite, onAddToMisc, isAdding }: PostCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mediaType, setMediaType] = useState<'video' | 'image'>(
    post.cover_image_url.endsWith('.mp4') ? 'video' : 'image'
  );

  const handleVideoError = () => {
    if (post.cover_image_url.endsWith('.mp4')) {
      console.log(`Video failed for ${post.post_id}, falling back to image`);
      setMediaType('image');
    }
  };

  return (
    <article className="mb-3">
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative">
        {/* Image count chip */}
        <div className={`absolute top-3 left-3 text-xs font-medium px-3 py-1 rounded-full z-20 ${
          post.image_count > 15
            ? 'bg-red-600 text-white'
            : post.image_count > 5
              ? 'bg-white text-black border border-black'
              : 'bg-black text-white'
        }`}>
          {post.image_count}
        </div>

        {/* Image or Video */}
        <div
          className="cursor-pointer relative bg-gray-100"
          style={post.cover_width && post.cover_height ? { aspectRatio: `${post.cover_width} / ${post.cover_height}` } : undefined}
          onClick={() => onPostClick?.(post.post_id)}
        >
          {/* Loading skeleton */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          )}

          {post.cover_image_url ? (
            mediaType === 'video' ? (
              <video
                src={ensureHttps(post.cover_image_url)}
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
                src={ensureHttps(post.cover_image_url)}
                alt={`Post ${post.post_id} by ${post.creator_username}`}
                className="w-full h-auto relative z-10"
                style={{ opacity: imageLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in' }}
                onLoad={() => setImageLoaded(true)}
                loading="lazy"
              />
            )
          ) : (
            <div className="w-full aspect-square bg-gray-200 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <p className="text-sm">Post #{post.post_id}</p>
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
              onCreatorClick?.(post.creator_username);
            }}
            className="text-xs font-medium text-gray-900 hover:text-red-600 transition-colors truncate min-w-0 flex-1 text-left"
          >
            @{post.creator_username}
          </button>

          {/* Icons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Heart (favorite) */}
            <button
              onClick={(e) => onToggleFavorite(post.post_id, post.is_favorited || false, e)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={post.is_favorited ? "Unfavorite" : "Favorite"}
            >
              <svg
                className={`w-5 h-5 ${post.is_favorited ? 'text-red-600' : ''}`}
                fill={post.is_favorited ? "currentColor" : "none"}
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
              href={`https://civitai.com/posts/${post.post_id}`}
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

            {/* Add to Miscellaneous (Plus icon) */}
            <button
              onClick={(e) => onAddToMisc(post.creator_username, post.post_id, e)}
              disabled={isAdding}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Add to Miscellaneous"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export function UnclaimedPosts({ onPostClick, onCreatorClick }: UnclaimedPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToMisc, setAddingToMisc] = useState<number | null>(null);

  useEffect(() => {
    fetchUnclaimedPosts();
  }, []);

  async function fetchUnclaimedPosts() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      // Get unclaimed posts (posts from creators with null user_id)
      const { data: unclaimedCreators } = await supabase
        .from('creators')
        .select('username')
        .is('user_id', null);

      if (!unclaimedCreators || unclaimedCreators.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const unclaimedUsernames = unclaimedCreators.map(c => c.username);

      // Get posts from these creators
      const { data: unclaimedPosts } = await supabase
        .from('posts')
        .select('post_id, creator_username, cover_image_url, cover_width, cover_height, image_count, nsfw, published_at')
        .in('creator_username', unclaimedUsernames)
        .order('post_id', { ascending: false });

      // Get favorite status if user is logged in
      let favoriteMap = new Map();
      if (user && unclaimedPosts && unclaimedPosts.length > 0) {
        const postIds = unclaimedPosts.map(p => p.post_id);
        const { data: interactions } = await supabase
          .from('post_interactions')
          .select('post_id, is_favorited')
          .eq('user_id', user.id)
          .in('post_id', postIds);

        favoriteMap = new Map(interactions?.map(i => [i.post_id, i.is_favorited]) || []);
      }

      const postsWithFavorites = (unclaimedPosts || []).map(post => ({
        ...post,
        is_favorited: favoriteMap.get(post.post_id) || false
      }));

      setPosts(postsWithFavorites);
    } catch (err) {
      console.error('Error fetching unclaimed posts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToMiscellaneous(creatorUsername: string, postId: number, e: React.MouseEvent) {
    e.stopPropagation();

    try {
      setAddingToMisc(postId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      // Claim the creator by updating their user_id
      const { error: claimError } = await supabase
        .from('creators')
        .update({ user_id: user.id })
        .eq('username', creatorUsername)
        .is('user_id', null);

      if (claimError) throw claimError;

      // Remove from list
      setPosts(posts.filter(p => p.creator_username !== creatorUsername));

      // Dispatch event to refresh Settings page
      window.dispatchEvent(new Event('postsAdded'));

      alert(`Added ${creatorUsername} to your creators`);
    } catch (err) {
      console.error('Error claiming creator:', err);
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setAddingToMisc(null);
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
        p.post_id === postId ? { ...p, is_favorited: newState } : p
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
      fetchUnclaimedPosts();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading unclaimed posts...</div>
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
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Unclaimed Posts</h1>
        <p className="text-sm text-gray-600 mt-2">Posts from creators not yet added to your account</p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center text-gray-600 py-16">
          <p className="text-xl">No unclaimed posts</p>
          <p className="text-sm mt-2">Posts from unclaimed creators will appear here</p>
        </div>
      ) : (
        <Masonry
          breakpointCols={breakpointColumns}
          className="flex -ml-3 w-auto"
          columnClassName="pl-3 bg-clip-padding"
        >
          {posts.map((post) => (
            <PostCard
              key={post.post_id}
              post={post}
              onPostClick={onPostClick}
              onCreatorClick={onCreatorClick}
              onToggleFavorite={toggleFavorite}
              onAddToMisc={handleAddToMiscellaneous}
              isAdding={addingToMisc === post.post_id}
            />
          ))}
        </Masonry>
      )}

      <div className="mt-8 mb-24 text-center text-gray-600">
        {posts.length} unclaimed post{posts.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
