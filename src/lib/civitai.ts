// Civitai API client
const CIVITAI_API_BASE = 'https://civitai.com/api/v1';

export interface CivitaiImage {
  id: number;
  url: string;
  nsfw: boolean;
  width: number;
  height: number;
  hash: string;
  postId: number;
  username?: string;
  createdAt?: string;
}

export interface CivitaiPost {
  id: number;
  title: string;
  publishedAt: string;
  nsfw: boolean;
  images: CivitaiImage[];
}

export interface CivitaiImagesResponse {
  items: CivitaiImage[];
  metadata: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    totalPages: number;
    nextPage?: string;
    prevPage?: string;
  };
}

export interface CivitaiCreator {
  username: string;
  modelCount?: number;
  link?: string;
}

/**
 * Fetch images by username
 * @param username - Civitai username
 * @param limit - Number of images to fetch (default: 100, max: 200)
 * @param cursor - Pagination cursor value (just the cursor, not full URL)
 */
export async function fetchImagesByUsername(
  username: string,
  limit: number = 100,
  cursor?: string,
  sortNewest: boolean = true
): Promise<CivitaiImagesResponse> {
  const params = new URLSearchParams({
    username,
    limit: limit.toString(),
    nsfw: 'true',
    sort: sortNewest ? 'Newest' : 'Most Reactions',
  });

  // Add cursor parameter if provided
  if (cursor) {
    params.append('cursor', cursor);
  }

  const url = `${CIVITAI_API_BASE}/images?${params}`;
  console.log(`🌐 Fetching: ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    // Try to get error details from response
    let errorDetails = response.statusText;
    try {
      const errorData = await response.json();
      errorDetails = JSON.stringify(errorData);
    } catch (e) {
      // If response isn't JSON, use statusText
    }
    throw new Error(`Civitai API error: ${response.status}. Details: ${errorDetails}`);
  }

  const data = await response.json();
  console.log(`📦 API returned ${data.items?.length || 0} images for ${username}`);
  return data;
}

/**
 * Fetch images by post ID
 * @param postId - Civitai post ID
 */
export async function fetchImagesByPostId(postId: number): Promise<CivitaiImagesResponse> {
  const params = new URLSearchParams({
    postId: postId.toString(),
    limit: '200', // Get all images from post
    nsfw: 'true',
  });

  const response = await fetch(`${CIVITAI_API_BASE}/images?${params}`);

  if (!response.ok) {
    throw new Error(`Civitai API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search for creators by username
 * @param query - Search query (username)
 * @param limit - Number of results (default: 20)
 */
export async function searchCreators(
  query: string,
  limit: number = 20
): Promise<{ items: CivitaiCreator[] }> {
  const params = new URLSearchParams({
    query,
    limit: limit.toString(),
  });

  const response = await fetch(`${CIVITAI_API_BASE}/creators?${params}`);

  if (!response.ok) {
    throw new Error(`Civitai API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Group images by post ID
 * @param images - Array of Civitai images
 * @returns Map of post ID to images array
 */
export function groupImagesByPost(images: CivitaiImage[]): Map<number, CivitaiImage[]> {
  const postMap = new Map<number, CivitaiImage[]>();

  for (const image of images) {
    if (!postMap.has(image.postId)) {
      postMap.set(image.postId, []);
    }
    postMap.get(image.postId)!.push(image);
  }

  return postMap;
}

/**
 * Get first image from each post with image count
 * @param images - Array of Civitai images
 * @returns Array of objects with first image and image count
 */
export function getFirstImagePerPost(images: CivitaiImage[]): Array<{ image: CivitaiImage; imageCount: number }> {
  const postMap = groupImagesByPost(images);
  return Array.from(postMap.values()).map(postImages => ({
    image: postImages[0],
    imageCount: postImages.length
  }));
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all images for a user by paginating through results
 * @param username - Civitai username
 * @param maxPages - Maximum number of pages to fetch (default: 10, ~2000 images)
 */
export async function fetchAllImagesByUsername(
  username: string,
  maxPages: number = 10
): Promise<CivitaiImage[]> {
  const allImages: CivitaiImage[] = [];
  let currentPage = 1;
  let hasMore = true;
  let retryCount = 0;
  const maxRetries = 3;

  while (hasMore && currentPage <= maxPages) {
    try {
      // Add delay between requests to avoid rate limiting (3 seconds per request)
      if (currentPage > 1) {
        await sleep(3000);
      }

      const response = await fetchImagesByUsername(username, 200, currentPage);
      allImages.push(...response.items);

      // Reset retry count on success
      retryCount = 0;

      console.log(`Fetched page ${currentPage} for ${username}:`, {
        imagesThisPage: response.items.length,
        totalSoFar: allImages.length,
        metadata: response.metadata,
        nextPage: response.metadata.nextPage
      });

      // Check if there are more pages by looking at:
      // 1. If nextPage exists in metadata, OR
      // 2. If we got a full page of results (200 items), there might be more
      hasMore = !!response.metadata.nextPage || response.items.length === 200;

      if (!hasMore) {
        console.log(`Stopping pagination: nextPage=${response.metadata.nextPage}, itemsReturned=${response.items.length}`);
      }

      currentPage++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';

      // If it's a 429 (rate limit) error, try exponential backoff
      if (errorMessage.includes('429') && retryCount < maxRetries) {
        retryCount++;
        const waitTime = Math.pow(2, retryCount) * 5000; // 10s, 20s, 40s
        console.warn(`⏳ Rate limited on page ${currentPage}. Waiting ${waitTime/1000}s before retry ${retryCount}/${maxRetries}...`);
        await sleep(waitTime);
        // Don't increment currentPage, retry the same page
        continue;
      }

      console.error(`❌ Error fetching page ${currentPage} for ${username}:`, error);
      break;
    }
  }

  // Count unique posts from fetched images
  const uniquePosts = new Set(allImages.map(img => img.postId));
  console.log(`✅ Total images fetched for ${username}: ${allImages.length}`);
  console.log(`📊 Unique posts discovered: ${uniquePosts.size} (need 638 total)`);

  return allImages;
}
