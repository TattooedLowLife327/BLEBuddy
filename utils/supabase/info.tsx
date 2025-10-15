/**
 * Supabase configuration values are sourced from Vite environment variables so we can
 * use the publishable (non-legacy) keys generated in the Supabase dashboard. Provide either:
 *  - VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 *  - or VITE_SUPABASE_PROJECT_ID + VITE_SUPABASE_ANON_KEY (URL will be derived)
 */

const envProjectId = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();
const envProjectUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '');
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const projectId = envProjectId || '';
export const publicAnonKey = envAnonKey || '';
export const projectUrl = envProjectUrl || (envProjectId ? `https://${envProjectId}.supabase.co` : '');
