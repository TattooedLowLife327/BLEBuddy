// Utility helpers for resolving profile picture URLs from various formats/locations.

const LOW_LIFE_STORE_DOMAIN = 'https://www.lowlifesofgranboard.com';

/**
 * Resolve a profile picture reference into a browser-usable URL.
 *
 * Supports:
 * - Full http/https URLs
 * - LowLifeStore asset paths
 * - Local `/assets` paths and `default-pfp.png`
 * - Supabase storage keys in the `profilepic` bucket
 */
export const resolveProfilePicUrl = (
  profilepic: string | undefined | null
): string | undefined => {
  if (!profilepic) return undefined;

  // Already a full URL
  if (profilepic.startsWith('http')) return profilepic;

  // LowLifeStore assets are served from the main PWA domain
  if (profilepic.includes('LowLifeStore')) {
    const path = profilepic.startsWith('/') ? profilepic : `/${profilepic}`;
    return `${LOW_LIFE_STORE_DOMAIN}${path}`;
  }

  // Local asset path (defaults only)
  if (
    profilepic.startsWith('/assets') ||
    profilepic.startsWith('assets') ||
    profilepic === 'default-pfp.png'
  ) {
    return profilepic.startsWith('/') ? profilepic : `/${profilepic}`;
  }

  // Storage path - construct Supabase public URL from env or fallback
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || 'https://sndsyxxcnuwjmjgikzgg.supabase.co';
  return `${supabaseUrl}/storage/v1/object/public/profilepic/${profilepic}`;
};

