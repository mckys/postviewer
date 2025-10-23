import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Eye } from 'lucide-react';

interface Post {
  post_id: number;
  creator_username: string;
  cover_image_url: string;
  cover_image_hash: string;
  image_count: number;
  nsfw: boolean;
  published_at: string;
}

interface HiddenPostsProps {
  onPostClick?: (postId: number) => void;
  onCreatorClick?: (username: string) => void;
}

export function HiddenPosts({ onPostClick, onCreatorClick }: HiddenPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHiddenPosts();
  }, []);

  async function fetchHiddenPosts() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get hidden post IDs
      const { data: hiddenInteractions } = await supabase
        .from('post_interactions')
        .select('post_id')
        .eq('user_id', user.id)
        .eq('is_hidden', true);

      if (!hiddenInteractions || hiddenInteractions.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const hiddenPostIds = hiddenInteractions.map(i => i.post_id);

      // Get the posts
      const { data: hiddenPosts } = await supabase
        .from('posts')
        .select('*')
        .in('post_id', hiddenPostIds)
        .order('published_at', { ascending: false });

      setPosts(hiddenPosts || []);
    } catch (err) {
      console.error('Error fetching hidden posts:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnhide(postId: number) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('post_interactions')
        .update({ is_hidden: false, updated_at: new Date().toISOString() })
        .eq('post_id', postId)
        .eq('user_id', user.id);

      // Remove from list
      setPosts(posts.filter(p => p.post_id !== postId));
    } catch (err) {
      console.error('Error unhiding post:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading hidden posts...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Hidden Posts</h1>
      </div>

      {posts.length === 0 ? (
        <div className="text-center text-gray-600 py-16">
          <p className="text-xl">No hidden posts</p>
          <p className="text-sm mt-2">Posts you hide will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {posts.map((post) => (
            <div
              key={post.post_id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative"
            >
              <div className="aspect-square overflow-hidden bg-gray-100 cursor-pointer">
                <img
                  src={post.cover_image_url}
                  alt={`Post ${post.post_id}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                  onClick={() => onPostClick?.(post.post_id)}
                  loading="lazy"
                />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => onCreatorClick?.(post.creator_username)}
                    className="text-sm font-medium text-gray-900 hover:text-red-600 transition-colors truncate"
                  >
                    @{post.creator_username}
                  </button>
                  {post.nsfw && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                      NSFW
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{post.image_count} image{post.image_count !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => handleUnhide(post.post_id)}
                    className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition-colors"
                    title="Unhide post"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Unhide</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center text-gray-600">
        Total: {posts.length} hidden post{posts.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
