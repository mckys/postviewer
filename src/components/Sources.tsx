import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SourceStats {
  page_url: string;
  count: number;
  latest_extracted: string;
}

export const Sources = () => {
  const [sources, setSources] = useState<SourceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSources();
  }, []);

  async function fetchSources() {
    try {
      setLoading(true);

      // Get sources with image count
      const { data, error } = await supabase
        .from('sources')
        .select(`
          source_url,
          last_scraped_at,
          posts (
            id,
            images (id)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats for each source
      const sourcesArray: SourceStats[] = data?.map((source: any) => {
        const imageCount = source.posts?.reduce((acc: number, post: any) => {
          return acc + (post.images?.length || 0);
        }, 0) || 0;

        return {
          page_url: source.source_url,
          count: imageCount,
          latest_extracted: source.last_scraped_at || new Date().toISOString()
        };
      }) || [];

      // Sort by count
      sourcesArray.sort((a, b) => b.count - a.count);
      setSources(sourcesArray);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSource() {
    if (!newSourceUrl.trim()) return;

    try {
      setSaving(true);

      // Step 1: Save source to database
      const { data: sourceData, error: sourceError } = await supabase
        .from('sources')
        .insert({
          source_url: newSourceUrl.trim(),
          status: 'pending'
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      // Step 2: Trigger Edge Function to scrape
      const edgeFunctionUrl = 'https://imhqapxkocdvhpqjsjip.supabase.co/functions/v1/scrape-source';

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          sourceId: sourceData.id,
          sourceUrl: newSourceUrl.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger scraping');
      }

      // Refresh sources list
      await fetchSources();

      // Reset form
      setNewSourceUrl('');
      setShowAddSource(false);

      alert('Source added! Scraping started in background.');
    } catch (err) {
      alert('Error saving source: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading sources...</div>
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

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="text-xl text-gray-600">No sources found</div>
        <button
          onClick={() => setShowAddSource(true)}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Source
        </button>
        {showAddSource && (
          <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-2xl">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Add New Source</h2>
            <div className="flex gap-3">
              <input
                type="url"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="Paste source URL here..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSource();
                }}
              />
              <button
                onClick={handleSaveSource}
                disabled={!newSourceUrl.trim() || saving}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
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
        <h1 className="text-4xl font-bold text-gray-900">Sources</h1>
        <button
          onClick={() => setShowAddSource(!showAddSource)}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showAddSource ? 'Cancel' : 'Add Source'}
        </button>
      </div>

      {showAddSource && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Add New Source</h2>
          <div className="flex gap-3">
            <input
              type="url"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="Paste source URL here..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSource();
              }}
            />
            <button
              onClick={handleSaveSource}
              disabled={!newSourceUrl.trim() || saving}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Images
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latest
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sources.map((source, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 truncate max-w-md">
                    {source.page_url}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {source.count}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(source.latest_extracted).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <a
                    href={source.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Visit →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8 text-center text-gray-600">
        Total: {sources.length} sources
      </div>
    </div>
  );
};
