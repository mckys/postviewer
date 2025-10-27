import { useState, useEffect } from 'react';
import { supabase, Creator, extractUsernameFromUrl } from '../lib/supabase';
import { Plus, Users, FileText, Image as ImageIcon, Heart, Star, Pencil, Check, X, Eraser } from 'lucide-react';
import { getStoredProfiles, saveProfile, removeProfile, getCurrentProfileEmail, type StoredProfile } from '../lib/profiles';

interface SettingsProps {
  onCreatorClick?: (username: string) => void;
  onViewHidden?: () => void;
  onViewUnclaimed?: () => void;
  onNSFWToggle?: () => void;
}

export const Settings = ({ onCreatorClick, onViewHidden, onViewUnclaimed, onNSFWToggle }: SettingsProps) => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [newCreatorUsername, setNewCreatorUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [myUsername, setMyUsername] = useState('');
  const [editingMyUsername, setEditingMyUsername] = useState(false);
  const [savingMyUsername, setSavingMyUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [syncingCreator, setSyncingCreator] = useState<string | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [showNSFW, setShowNSFW] = useState(true);
  const [storedProfiles, setStoredProfiles] = useState<StoredProfile[]>([]);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [tempNickname, setTempNickname] = useState('');

  // console.log(`🔄 Settings rendering with ${creators.length} creators:`, creators.map(c => c.username));

  useEffect(() => {
    fetchCreators();
    fetchMyUsername();
    fetchDashboardStats();
    fetchUserProfile();
    fetchNSFWPreference();
    loadStoredProfiles();

    // Poll for sync status and dashboard stats every 5 seconds
    const interval = setInterval(() => {
      checkSyncStatus();
      fetchDashboardStats(); // Also refresh stats to catch extension updates
    }, 5000);

    // Listen for sync completion from App.tsx
    const handleSyncCompleted = () => {
      console.log('🔄 Sync completed, refreshing dashboard stats...');
      fetchDashboardStats();
      fetchCreators();
    };

    // Listen for posts added via browser extension
    const handlePostsAdded = () => {
      console.log('📝 Posts added via extension, refreshing dashboard stats...');
      fetchDashboardStats();
      fetchCreators();
    };

    window.addEventListener('syncCompleted', handleSyncCompleted);
    window.addEventListener('postsAdded', handlePostsAdded);

    return () => {
      clearInterval(interval);
      window.removeEventListener('syncCompleted', handleSyncCompleted);
      window.removeEventListener('postsAdded', handlePostsAdded);
    };
  }, []);

  async function checkSyncStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all creators' sync status
      const { data: creatorsData } = await supabase
        .from('creators')
        .select('username, sync_status')
        .eq('user_id', user.id);

      if (creatorsData && creatorsData.length > 0) {
        // Update only the sync_status without refetching everything
        setCreators(prevCreators =>
          prevCreators.map(creator => {
            const updated = creatorsData.find(c => c.username === creator.username);
            return updated ? { ...creator, sync_status: updated.sync_status } : creator;
          })
        );
      }
    } catch (err) {
      console.error('Error checking sync status:', err);
    }
  }

  async function fetchMyUsername() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get username from database
      const { data, error } = await supabase
        .from('user_settings')
        .select('civitai_username')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        throw error;
      }

      setMyUsername(data?.civitai_username || '');
    } catch (err) {
      console.error('Error fetching my username:', err);
    }
  }

  function handleEditMyUsername() {
    setTempUsername(myUsername);
    setEditingMyUsername(true);
  }

  function handleCancelEditMyUsername() {
    setTempUsername('');
    setEditingMyUsername(false);
  }

  async function handleSaveMyUsername() {
    try {
      setSavingMyUsername(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not logged in');
      }

      // Save to database
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          civitai_username: tempUsername,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setMyUsername(tempUsername);
      setEditingMyUsername(false);
    } catch (err) {
      alert('Error saving username: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSavingMyUsername(false);
    }
  }

  async function fetchDashboardStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get my creators
      const { data: myCreators } = await supabase
        .from('creators')
        .select('username')
        .eq('user_id', user.id);

      const creatorUsernames = myCreators?.map(c => c.username) || [];

      if (creatorUsernames.length === 0) {
        setTotalPosts(0);
        setTotalImages(0);
        setFavoritesCount(0);
        return;
      }

      // Get total posts from my creators (only posts with cover images - displayable posts)
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .in('creator_username', creatorUsernames)
        .not('cover_image_url', 'is', null); // Only count displayable posts
      setTotalPosts(postsCount || 0);

      // Get total images - count directly from images table filtering by creator
      // This is more efficient than getting all post IDs first
      const { count: imagesCount } = await supabase
        .from('images')
        .select('image_id, posts!inner(creator_username, cover_image_url)', { count: 'exact', head: true })
        .in('posts.creator_username', creatorUsernames)
        .not('posts.cover_image_url', 'is', null);

      setTotalImages(imagesCount || 0);

      // Get my favorites count
      const { count: favCount } = await supabase
        .from('post_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_favorited', true);
      setFavoritesCount(favCount || 0);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  }

  async function fetchCreators() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('creators')
        .select('*')
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) throw error;

      // Get post counts for each creator with individual count queries (bypasses 1000 row limit)
      const countPromises = (data || []).map(async (creator) => {
        const { count } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('creator_username', creator.username)
          .not('cover_image_url', 'is', null);

        return { username: creator.username, count: count || 0 };
      });

      const counts = await Promise.all(countPromises);

      // Create map of username -> count
      const countMap = new Map<string, number>();
      counts.forEach(({ username, count }) => {
        countMap.set(username, count);
      });

      const creatorsWithCounts = (data || []).map(creator => {
        const count = countMap.get(creator.username) || 0;
        return {
          ...creator,
          actual_post_count: count
        };
      });
      setCreators(creatorsWithCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCreator() {
    if (!newCreatorUsername.trim()) return;

    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to add creators');
      }

      // Clean up username: remove @ symbols and whitespace
      let username = newCreatorUsername.trim().replace(/@/g, '');

      // Validate username
      if (!username) {
        throw new Error('Username cannot be empty');
      }

      if (username.includes(' ')) {
        throw new Error('Username cannot contain spaces');
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
      }

      // Check if creator exists for this user
      const { data: existingForUser } = await supabase
        .from('creators')
        .select('username')
        .eq('username', username)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingForUser) {
        throw new Error(`Creator "${username}" is already in your list`);
      }

      // Check if creator exists without a user_id (from browser extension)
      const { data: orphanedCreator } = await supabase
        .from('creators')
        .select('id, username')
        .eq('username', username)
        .is('user_id', null)
        .maybeSingle();

      if (orphanedCreator) {
        // Update the orphaned creator to belong to this user
        console.log(`📝 Claiming orphaned creator: ${username}`);
        const { error: updateError } = await supabase
          .from('creators')
          .update({ user_id: user.id })
          .eq('id', orphanedCreator.id);

        if (updateError) throw updateError;
      } else {
        // Insert new creator with user_id
        const { error: insertError } = await supabase
          .from('creators')
          .insert({
            username,
            user_id: user.id
          });

        if (insertError) throw insertError;
      }

      // Refresh list
      await fetchCreators();

      // Trigger background sync for the new creator
      console.log('🔄 Triggering sync for new creator...');
      window.dispatchEvent(new Event('triggerSync'));

      // Reset form
      setNewCreatorUsername('');
      setShowAddCreator(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveCreator(id: number, username: string) {
    if (!confirm(`Remove creator "${username}"?`)) return;

    try {
      console.log(`🗑️  Removing creator ${username} (id: ${id})`);

      // Check if creator exists before deleting
      const { data: beforeCheck } = await supabase
        .from('creators')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      console.log('Before delete - creator exists?', beforeCheck);

      const { data: deleteResult, error } = await supabase
        .from('creators')
        .delete()
        .eq('id', id)
        .select();

      console.log('Delete result:', deleteResult);

      if (error) {
        console.error('❌ Delete error:', error);
        throw error;
      }

      // Check if creator still exists after deleting
      const { data: afterCheck } = await supabase
        .from('creators')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      console.log('After delete - creator still exists?', afterCheck);

      console.log('✅ Creator deleted, refreshing list...');
      await fetchCreators();
    } catch (err) {
      console.error('❌ Error in handleRemoveCreator:', err);
      alert('Error removing creator: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function checkCursors() {
    const { data } = await supabase
      .from('creators')
      .select('username, sync_status, last_cursor, total_posts');

    console.log('=== CURSOR STATUS ===');
    console.table(data);
    data?.forEach(c => {
      console.log(`\n${c.username}:`);
      console.log(`  Status: ${c.sync_status}`);
      console.log(`  Cursor: ${c.last_cursor || 'NULL (no more data or initial)'}`);
      console.log(`  Posts: ${c.total_posts}`);
    });
  }

  async function fetchUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }

  async function fetchNSFWPreference() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('show_nsfw')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Default to true if not set
      setShowNSFW(data?.show_nsfw ?? true);
    } catch (err) {
      console.error('Error fetching NSFW preference:', err);
    }
  }

  async function handleToggleNSFW() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newValue = !showNSFW;
      setShowNSFW(newValue);

      // Save to database
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          show_nsfw: newValue,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Trigger refresh of feeds
      onNSFWToggle?.();
    } catch (err) {
      console.error('Error updating NSFW preference:', err);
      // Revert on error
      setShowNSFW(!showNSFW);
    }
  }

  function loadStoredProfiles() {
    const profiles = getStoredProfiles();
    setStoredProfiles(profiles);
  }

  function handleEditNickname(email: string) {
    const profile = storedProfiles.find(p => p.email === email);
    setEditingProfile(email);
    setTempNickname(profile?.nickname || '');
  }

  function handleCancelEditNickname() {
    setEditingProfile(null);
    setTempNickname('');
  }

  function handleSaveNickname(email: string, password: string) {
    saveProfile({ email, password, nickname: tempNickname });
    setEditingProfile(null);
    setTempNickname('');
    loadStoredProfiles();
    // Notify Navigation component to refresh profiles
    window.dispatchEvent(new Event('profilesUpdated'));
  }

  function handleRemoveProfile(email: string) {
    if (!confirm(`Remove profile "${email}"?`)) return;
    removeProfile(email);
    loadStoredProfiles();
    // Notify Navigation component to refresh profiles
    window.dispatchEvent(new Event('profilesUpdated'));
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      console.error('Error logging out:', err);
      alert('Error logging out');
    }
  }

  async function handleSyncCreator(username: string) {
    try {
      setSyncingCreator(username);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not logged in');
      }

      // Set status to pending
      await supabase
        .from('creators')
        .update({ sync_status: 'pending' })
        .eq('username', username)
        .eq('user_id', user.id);

      console.log(`🔄 Starting sync for ${username}. This may take several minutes...`);

      // Start sync in background
      const { syncCreator } = await import('../lib/sync');

      // Use progress callback to log updates and update UI
      syncCreator(username, async (progress) => {
        console.log(`📊 Sync progress for ${username}: ${progress.totalPosts} posts, ${progress.totalImages} images (page ${progress.currentPage})`);

        // Query for displayable posts count (with cover images)
        const { count } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('creator_username', username)
          .not('cover_image_url', 'is', null);

        // Update the creator's post count in real-time
        setCreators(prev => prev.map(c =>
          c.username === username
            ? { ...c, actual_post_count: count || 0, total_posts: progress.totalPosts }
            : c
        ));
      }, { fullBackfill: true, userId: user.id }).then(async () => {
        console.log(`✅ Sync completed for ${username}`);
        // Refresh stats when done
        await fetchCreators();
        await fetchDashboardStats();
        setSyncingCreator(null);
      }).catch((err) => {
        // If sync was cancelled, don't show error or refresh
        if (err instanceof Error && err.message === 'SYNC_CANCELLED') {
          console.log(`🛑 Sync was cancelled for ${username}`);
          return;
        }
        console.error(`❌ Sync failed for ${username}:`, err);
        alert('Sync error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        setSyncingCreator(null);
      });

      // Don't wait for sync to complete - let it run in background
      // Just show immediate feedback
      console.log(`⏳ Sync started for ${username} in background. Check console for progress updates.`);

    } catch (err) {
      alert('Sync error: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setSyncingCreator(null);
    }
  }

  async function handleResetSync(username: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not logged in');

      console.log(`🛑 Stopping sync for ${username}...`);

      // Reset sync status to completed (will cause running sync to cancel)
      const { error } = await supabase
        .from('creators')
        .update({ sync_status: 'completed' })
        .eq('username', username)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log(`✅ Sync stopped for ${username}`);

      // Update local state without full refresh
      setCreators(prev => prev.map(c =>
        c.username === username ? { ...c, sync_status: 'completed' } : c
      ));
      setSyncingCreator(null);
    } catch (err) {
      console.error('Error stopping sync:', err);
    }
  }

  async function handleCleanupPosts(username: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not logged in');

      // Count posts with no cover image (null or empty string)
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('creator_username', username)
        .or('cover_image_url.is.null,cover_image_url.eq.');

      if (!count || count === 0) {
        alert(`No posts to clean up for ${username}`);
        return;
      }

      const confirmed = window.confirm(
        `Found ${count} post(s) with no cover image for ${username}.\n\n` +
        `These posts cannot be displayed and will be deleted from the database.\n\n` +
        `Continue?`
      );

      if (!confirmed) return;

      console.log(`🗑️ Cleaning up ${count} posts with no cover image for ${username}...`);

      // Get the post IDs to delete
      const { data: postsToDelete } = await supabase
        .from('posts')
        .select('post_id')
        .eq('creator_username', username)
        .or('cover_image_url.is.null,cover_image_url.eq.');

      if (!postsToDelete || postsToDelete.length === 0) {
        throw new Error('No posts found to delete');
      }

      const postIds = postsToDelete.map(p => p.post_id);
      console.log(`📋 Deleting ${postIds.length} posts...`);

      // First, delete all images for these posts (foreign key constraint)
      const { error: imageDeleteError, count: imageDeletedCount } = await supabase
        .from('images')
        .delete({ count: 'exact' })
        .in('post_id', postIds);

      if (imageDeleteError) throw imageDeleteError;

      console.log(`✅ Deleted ${imageDeletedCount || 0} images`);

      // Now delete the posts
      const { error: postDeleteError, count: postDeletedCount } = await supabase
        .from('posts')
        .delete({ count: 'exact' })
        .in('post_id', postIds);

      if (postDeleteError) throw postDeleteError;

      console.log(`✅ Deleted ${postDeletedCount || 0} posts`);

      // Update the creator's total_posts count
      const { count: remainingCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('creator_username', username);

      await supabase
        .from('creators')
        .update({ total_posts: remainingCount || 0 })
        .eq('username', username);

      alert(`Successfully deleted ${postDeletedCount || 0} post(s) and ${imageDeletedCount || 0} image(s) for ${username}`);

      // Refresh the list
      await fetchCreators();
      await fetchDashboardStats();
    } catch (err) {
      console.error('Error cleaning up posts:', err);
      alert('Cleanup error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading settings...</div>
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Dashboard */}
      <div className="bg-gray-900 rounded-lg shadow-md p-6 mb-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Total Creators */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Users className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" strokeWidth={0.5} />
            <div>
              <p className="text-xs sm:text-sm text-gray-400">Creators</p>
              <p className="text-2xl sm:text-3xl font-semibold text-white">{creators.length}</p>
            </div>
          </div>

          {/* Total Posts */}
          <div className="flex items-center gap-3 sm:gap-4">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" strokeWidth={0.5} />
            <div>
              <p className="text-xs sm:text-sm text-gray-400">Posts</p>
              <p className="text-2xl sm:text-3xl font-semibold text-white">{totalPosts.toLocaleString()}</p>
            </div>
          </div>

          {/* Total Images */}
          <div className="flex items-center gap-3 sm:gap-4">
            <ImageIcon className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" strokeWidth={0.5} />
            <div>
              <p className="text-xs sm:text-sm text-gray-400">Images</p>
              <p className="text-2xl sm:text-3xl font-semibold text-white">{totalImages.toLocaleString()}</p>
            </div>
          </div>

          {/* Favorites */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Heart className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" strokeWidth={0.5} />
            <div>
              <p className="text-xs sm:text-sm text-gray-400">Favorites</p>
              <p className="text-2xl sm:text-3xl font-semibold text-white">{favoritesCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Version number */}
      <div className="text-center text-xs text-black mb-6">
        v{import.meta.env.VITE_APP_VERSION || '0.2.0'}
      </div>

      {/* Creators List */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Creators</h2>
        <button
          onClick={() => setShowAddCreator(!showAddCreator)}
          className="w-10 h-10 p-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {showAddCreator && (
        <div className="grid grid-cols-3 sm:grid-cols-4 items-center gap-4 py-3 px-4 bg-white rounded-lg shadow-sm mb-2">
          <div className="col-span-2 flex items-center gap-2 min-w-0">
            <input
              type="text"
              name="creatorhandle"
              value={newCreatorUsername}
              onChange={(e) => setNewCreatorUsername(e.target.value)}
              placeholder="@username"
              className="w-full text-base font-medium text-gray-900 border-b border-red-600 focus:outline-none bg-transparent"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCreator();
                if (e.key === 'Escape') {
                  setShowAddCreator(false);
                  setNewCreatorUsername('');
                }
              }}
              autoFocus
            />
          </div>
          <div className="hidden sm:block"></div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddCreator(false);
                setNewCreatorUsername('');
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Cancel"
            >
              <X className="w-5 h-5 text-red-600" />
            </button>
            <button
              onClick={handleAddCreator}
              disabled={!newCreatorUsername.trim() || saving}
              className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Save"
            >
              <Check className="w-5 h-5 text-green-600" />
            </button>
          </div>
        </div>
      )}

      {creators.length === 0 ? (
        <div className="text-center text-gray-600 py-8">
          No creators added yet.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {creators.map((creator) => (
              <div key={creator.id} className="grid grid-cols-3 sm:grid-cols-4 items-center gap-4 py-3 px-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => onCreatorClick?.(creator.username)}
                    className="text-base font-medium text-gray-900 hover:text-red-600 transition-colors text-left truncate"
                  >
                    @{creator.username}
                  </button>
                  {creator.username === myUsername && (
                    <Star className="w-4 h-4 text-red-600 fill-red-600 flex-shrink-0" strokeWidth={0} />
                  )}
                </div>
                <div className="flex justify-start">
                  <div className="bg-gray-900 text-white px-4 py-2 rounded-full flex items-center">
                    <span className="text-sm font-semibold tracking-tight leading-none">
                      {creator.actual_post_count || 0}
                    </span>
                  </div>
                </div>
                <span className="hidden sm:block text-sm text-gray-500">
                  {new Date(creator.added_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                <div className="flex items-center gap-2 justify-end">
                  {/* Sync button - click to sync or reset if stuck */}
                  <button
                    onClick={() => {
                      if (creator.sync_status === 'syncing' || syncingCreator === creator.username) {
                        handleResetSync(creator.username);
                      } else {
                        handleSyncCreator(creator.username);
                      }
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title={creator.sync_status === 'syncing' ? 'Click to stop sync' : 'Sync creator'}
                  >
                    <svg
                      className={`w-5 h-5 ${(syncingCreator === creator.username || creator.sync_status === 'syncing') ? 'animate-spin text-gray-400' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20,4v5h-.6M4.1,11c.6-4.4,4.6-7.5,8.9-6.9,2.9.4,5.3,2.3,6.4,4.9M19.4,9h-4.4M4,20v-5h.6M4.6,15c1.7,4.1,6.3,6.1,10.4,4.4,2.7-1.1,4.6-3.5,4.9-6.4M4.6,15h4.4"/>
                    </svg>
                  </button>

                  {/* Cleanup button - delete posts with no cover image */}
                  <button
                    onClick={() => handleCleanupPosts(creator.username)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Clean up posts with no cover image"
                  >
                    <Eraser className="w-5 h-5" />
                  </button>

                  {/* Visit on Civitai button */}
                  <a
                    href={`https://civitai.com/user/${creator.username}/posts`}
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

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveCreator(creator.id, creator.username)}
                    disabled={syncingCreator === creator.username}
                    className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove creator"
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
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Content Preferences */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-2xl font-bold text-gray-900">Content Preferences</h2>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-4 items-center gap-4 py-3 px-4 bg-white rounded-lg shadow-sm">
          <div className="col-span-3">
            <span className="text-base font-medium text-gray-900">Show NSFW Content</span>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={handleToggleNSFW}
              className={`relative inline-flex h-[26px] w-[58px] items-center p-1 rounded transition-colors ${
                showNSFW ? 'bg-red-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`h-[18px] w-[24px] rounded-sm bg-white transition-transform ${
                  showNSFW ? 'translate-x-[26px]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 items-center gap-4 py-3 px-4 bg-white rounded-lg shadow-sm">
          <div className="col-span-3">
            <span className="text-base font-medium text-gray-900">View Hidden Posts</span>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={onViewHidden}
              className="w-[58px] h-[26px] bg-gray-900 text-white text-sm rounded hover:bg-gray-800 transition-colors"
            >
              View
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 items-center gap-4 py-3 px-4 bg-white rounded-lg shadow-sm">
          <div className="col-span-3">
            <span className="text-base font-medium text-gray-900">View Scraped Posts</span>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={onViewUnclaimed}
              className="w-[58px] h-[26px] bg-gray-900 text-white text-sm rounded hover:bg-gray-800 transition-colors"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* My Username Section */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-2xl font-bold text-gray-900">My Username</h2>
      </div>

      <div className="grid grid-cols-4 items-center gap-4 py-3 px-4 bg-white rounded-lg shadow-sm">
        <div className="relative">
          <span className="text-base font-medium text-gray-900">
            {myUsername ? `@${myUsername}` : 'Not set'}
          </span>
          {editingMyUsername && (
            <input
              type="text"
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              placeholder="@username"
              className="absolute inset-0 text-base font-medium text-gray-900 border-b-2 border-red-600 focus:outline-none bg-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveMyUsername();
                if (e.key === 'Escape') handleCancelEditMyUsername();
              }}
              autoFocus
            />
          )}
        </div>
        <div></div>
        <div></div>
        <div className="flex items-center gap-2 justify-end">
          {editingMyUsername ? (
            <>
              <button
                onClick={handleCancelEditMyUsername}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5 text-red-600" />
              </button>
              <button
                onClick={handleSaveMyUsername}
                disabled={savingMyUsername}
                className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                title="Save"
              >
                <Check className="w-5 h-5 text-green-600" />
              </button>
            </>
          ) : (
            <button
              onClick={handleEditMyUsername}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Edit username"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Profile Management */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-2xl font-bold text-gray-900">Saved Profiles</h2>
      </div>

      <div className="space-y-2 mb-8">
        {storedProfiles.length === 0 ? (
          <div className="text-center text-gray-600 py-4 bg-white rounded-lg shadow-sm">
            No saved profiles yet. Login to save your profile.
          </div>
        ) : (
          storedProfiles.map((profile) => {
            const isCurrent = profile.email === userEmail;
            const isEditing = editingProfile === profile.email;

            return (
              <div key={profile.email} className="grid grid-cols-3 sm:grid-cols-4 items-center gap-4 py-3 px-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center gap-2 min-w-0 col-span-2 sm:col-span-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={tempNickname}
                      onChange={(e) => setTempNickname(e.target.value)}
                      placeholder="Nickname (optional)"
                      className="w-full text-base font-medium text-gray-900 border-b border-red-600 focus:outline-none bg-transparent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNickname(profile.email, profile.password);
                        if (e.key === 'Escape') handleCancelEditNickname();
                      }}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base font-medium text-gray-900 truncate">
                        {profile.nickname || profile.email}
                      </span>
                      {isCurrent && (
                        <Star className="w-4 h-4 text-red-600 fill-red-600 flex-shrink-0" strokeWidth={0} />
                      )}
                    </div>
                  )}
                </div>
                <div className="hidden sm:block text-sm text-gray-500 truncate">
                  {profile.nickname ? profile.email : ''}
                </div>
                <div className="hidden sm:block"></div>
                <div className="flex items-center gap-2 justify-end">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEditNickname}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Cancel"
                      >
                        <X className="w-5 h-5 text-red-600" />
                      </button>
                      <button
                        onClick={() => handleSaveNickname(profile.email, profile.password)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Save"
                      >
                        <Check className="w-5 h-5 text-green-600" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditNickname(profile.email)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Edit nickname"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRemoveProfile(profile.email)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Remove profile"
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
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Logout Button */}
      <div className="mt-8">
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors text-base font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
};
