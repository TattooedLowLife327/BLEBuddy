/**
 * Resolves profile pic URLs from player.player_profiles.profilepic
 * Handles three formats:
 * 1. Full URLs (already resolved)
 * 2. LowLifeStore asset paths (store purchases: /assets/LowLifeStore/...) - served from main PWA
 * 3. Local asset paths (default-pfp.png)
 * 4. Storage paths (Supabase storage: user-id.png)
 */
export const resolveProfilePicUrl = (profilepic: string | null | undefined): string | undefined => {
  if (!profilepic) return undefined;

  // Already a full URL
  if (profilepic.startsWith('http')) return profilepic;

  // LowLifeStore assets are served from the main PWA domain
  if (profilepic.includes('LowLifeStore')) {
    const path = profilepic.startsWith('/') ? profilepic : `/${profilepic}`;
    return `https://www.lowlifesofgranboard.com${path}`;
  }

  // Local asset path (defaults only - not store purchases)
  if (profilepic.startsWith('/assets') || profilepic.startsWith('assets') || profilepic === 'default-pfp.png') {
    return profilepic.startsWith('/') ? profilepic : `/${profilepic}`;
  }

  // Storage path - construct Supabase public URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sndsyxxcnuwjmjgikzgg.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/profilepic/${profilepic}`;
};
