/**
 * Resolves a public asset path to include Vite's base URL.
 * Handles paths starting with '/' or relative paths, and prevents duplicating base URL.
 */
export function getAssetUrl(path: string): string {
  if (!path) return path;
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }

  const base = import.meta.env.BASE_URL || '/';

  // If base is root '/' or empty
  if (base === '/' || base === '') {
    return path.startsWith('/') ? path : `/${path}`;
  }

  // Normalize base to have leading and trailing slash: e.g. '/chu-tich-ho-chi-minh/'
  const cleanBase = (base.startsWith('/') ? base : `/${base}`).replace(/\/+$/, '/');

  // Normalize input path to have leading slash for comparison: e.g. '/chu-tich-ho-chi-minh/arts/...'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // If path already starts with cleanBase, return normalizedPath directly to prevent duplication
  if (normalizedPath.startsWith(cleanBase)) {
    return normalizedPath;
  }

  // Strip leading slash from original path before combining with cleanBase
  const relativePath = path.startsWith('/') ? path.slice(1) : path;
  return `${cleanBase}${relativePath}`;
}

