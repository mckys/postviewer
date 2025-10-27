import { useState, useEffect } from 'react';
import { supabase, ensureHttps } from '../lib/supabase';

interface ImageData {
  id: number;
  url: string;
  post_id: number;
  image_url: string;
  extracted_at: string;
  posts?: {
    post_url: string;
  };
}

export const ImageGrid = () => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchImages();
  }, []);

  async function fetchImages() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('images')
        .select(`
          *,
          posts (
            post_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setImages(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading images...</div>
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

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">No images found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8 text-gray-900">PostViewer</h1>
      <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
        {images.map((item) => (
          <div
            key={item.id}
            className="break-inside-avoid mb-6"
          >
            <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
              <img
                src={ensureHttps(item.image_url)}
                alt={`Image from ${item.posts?.post_url}`}
                className="w-full h-auto"
                loading="lazy"
              />
              <div className="p-4">
                <a
                  href={item.posts?.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 truncate block mb-2"
                >
                  View Source Page →
                </a>
                <p className="text-xs text-gray-500">
                  Extracted: {new Date(item.extracted_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center text-gray-600">
        Total: {images.length} images
      </div>
    </div>
  );
};
