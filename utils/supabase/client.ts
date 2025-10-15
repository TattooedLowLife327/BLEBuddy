import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { projectId, projectUrl, publicAnonKey } from './info';

let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    const url = projectUrl || (projectId ? `https://${projectId}.supabase.co` : '');

    if (!url) {
      throw new Error(
        'Supabase URL is not configured. Set VITE_SUPABASE_URL or VITE_SUPABASE_PROJECT_ID in your environment.'
      );
    }

    if (!publicAnonKey) {
      throw new Error(
        'Supabase publishable key is not configured. Set VITE_SUPABASE_ANON_KEY in your environment.'
      );
    }

    supabaseInstance = createSupabaseClient(
      url,
      publicAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        },
        db: {
          schema: 'player'
        }
      }
    );
  }
  return supabaseInstance;
}
