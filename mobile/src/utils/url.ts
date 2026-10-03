/**
 * Turns what a person types into a usable base URL:
 *   "192.168.1.20:3000"          → "http://192.168.1.20:3000/api"
 *   "https://doall.example.com/" → "https://doall.example.com/api"
 * Returns null when there is no host to talk to.
 */
export function normalizeApiUrl(input: string): string | null {
  const match = input
    .trim()
    .match(
      /^(https?:\/\/)?([a-z0-9.-]+|\[[0-9a-f:]+\])(:\d{1,5})?(\/[^\s?#]*)?$/i,
    );
  if (!match) {
    return null;
  }
  const [, scheme = 'http://', host, port = '', rawPath = ''] = match;
  const path = rawPath.replace(/\/+$/, '') || '/api';
  return `${scheme.toLowerCase()}${host}${port}${path}`;
}

/** "http://192.168.1.20:3000/api" → "192.168.1.20:3000" (for compact display). */
export const displayHost = (url: string) =>
  url.replace(/^https?:\/\//, '').replace(/\/api$/, '');
