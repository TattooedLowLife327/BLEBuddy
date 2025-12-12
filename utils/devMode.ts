// Dev mode utility - activate with ?dev=1 in URL
// Allows testing without a real Granboard connected

export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('dev') === '1';
}
