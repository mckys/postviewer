import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wpjhhtxwbmmzhqgmlfwj.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwamhodHh3Ym1temhxZ21sZndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU5NDU2MzcsImV4cCI6MjA2MTUyMTYzN30.EWqj_sUevqYoE8DbG6DqZzIGJpxNHYZNFo4zqPxE_6Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  }
});

export interface Creator {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  added_at: string;
  updated_at: string;
  sync_status?: string;
  total_posts?: number;
  actual_post_count?: number;
}

/**
 * Get current user ID for database queries
 */
export async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Get user's NSFW preference
 * @returns true if user wants to see NSFW content, false otherwise
 */
export async function getUserNSFWPreference(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return true; // Default to showing NSFW if not logged in

  const { data } = await supabase
    .from('user_settings')
    .select('show_nsfw')
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.show_nsfw ?? true; // Default to true if not set
}

/**
 * Extract username from Civitai user URL
 * @param url - URL like https://civitai.com/user/username/posts
 * @returns username or null if invalid
 */
export function extractUsernameFromUrl(url: string): string | null {
  const match = url.match(/civitai\.com\/user\/([^\/]+)/);
  return match ? match[1] : null;
}
