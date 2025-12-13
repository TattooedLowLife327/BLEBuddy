/**
 * Resolves profile pic URLs from player.player_profiles.profilepic
 * Handles three formats:
 * 1. Full URLs (already resolved)
 * 2. Local asset paths (store purchases: /assets/LowLifeStore/...)
 * 3. Storage paths (Supabase storage: user-id.png)
 */
export const resolveProfilePicUrl = (profilepic: string | null | undefined): string | undefined => {
  if (!profilepic) return undefined;

  // Already a full URL
  if (profilepic.startsWith('http')) return profilepic;

  // Local asset path (store purchases or defaults)
  if (profilepic.startsWith('/assets') || profilepic.startsWith('assets') || profilepic === 'default-pfp.png') {
    return profilepic.startsWith('/') ? profilepic : `/${profilepic}`;
  }

  // Storage path - construct Supabase public URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sndsyxxcnuwjmjgikzgg.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/profilepic/${profilepic}`;
};
