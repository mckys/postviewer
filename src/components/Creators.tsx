import { useState, useEffect } from 'react';
import { supabase, Creator, extractUsernameFromUrl } from '../lib/supabase';

export const Creators = () => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [newCreatorUrl, setNewCreatorUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCreators();
  }, []);

  async function fetchCreators() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('creators')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) throw error;

      setCreators(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCreator() {
    if (!newCreatorUrl.trim()) return;

    try {
      setSaving(true);

      // Extract username from URL
      const username = extractUsernameFromUrl(newCreatorUrl.trim());

      if (!username) {
        throw new Error('Invalid Civitai user URL. Expected format: https://civitai.com/user/username/posts');
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from('creators')
        .select('username')
        .eq('username', username)
        .maybeSingle();

      if (existing) {
        throw new Error(`Creator "${username}" is already in your list`);
      }

      // Insert creator
      const { error: insertError } = await supabase
        .from('creators')
        .insert({ username });

      if (insertError) throw insertError;

      // Refresh list
      await fetchCreators();

      // Reset form
      setNewCreatorUrl('');
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
      const { error } = await supabase
        .from('creators')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchCreators();
    } catch (err) {
      alert('Error removing creator: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading creators...</div>
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

  if (creators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="text-xl text-gray-600">No creators added yet</div>
        <button
          onClick={() => setShowAddCreator(true)}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Creator
        </button>
        {showAddCreator && (
          <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-2xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Add Creator</h2>
            <p className="text-sm text-gray-600 mb-4">
              Paste the creator's posts URL (e.g., https://civitai.com/user/username/posts)
            </p>
            <div className="flex gap-3">
              <input
                type="url"
                value={newCreatorUrl}
                onChange={(e) => setNewCreatorUrl(e.target.value)}
                placeholder="https://civitai.com/user/username/posts"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCreator();
                }}
              />
              <button
                onClick={handleAddCreator}
                disabled={!newCreatorUrl.trim() || saving}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Creators</h1>
        <button
          onClick={() => setShowAddCreator(!showAddCreator)}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddCreator ? 'Cancel' : 'Add Creator'}
        </button>
      </div>

      {showAddCreator && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Add Creator</h2>
          <p className="text-sm text-gray-600 mb-4">
            Paste the creator's posts URL (e.g., https://civitai.com/user/username/posts)
          </p>
          <div className="flex gap-3">
            <input
              type="url"
              value={newCreatorUrl}
              onChange={(e) => setNewCreatorUrl(e.target.value)}
              placeholder="https://civitai.com/user/username/posts"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCreator();
              }}
            />
            <button
              onClick={handleAddCreator}
              disabled={!newCreatorUrl.trim() || saving}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Added
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {creators.map((creator) => (
              <tr key={creator.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {creator.username}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(creator.added_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-3">
                  <a
                    href={`https://civitai.com/user/${creator.username}/posts`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Visit →
                  </a>
                  <button
                    onClick={() => handleRemoveCreator(creator.id, creator.username)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8 text-center text-gray-600">
        Total: {creators.length} {creators.length === 1 ? 'creator' : 'creators'}
      </div>
    </div>
  );
};
