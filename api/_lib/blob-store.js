import { put, list, del } from '@vercel/blob';

// Small JSON "documents" (the memories list, the doodle image URL) live in
// Vercel Blob. Vercel's own guidance is to treat blobs as immutable and
// avoid overwriting the same pathname repeatedly — the CDN can keep serving
// a stale cached copy of the old content for a while after an overwrite.
// So instead of writing to a fixed filename, each write goes to a fresh,
// timestamped pathname; reads list everything under that prefix and use the
// newest one; and old versions are pruned right after each write so this
// doesn't grow forever.

export async function readJson(prefix, fallback) {
  try {
    const { blobs } = await list({ prefix, limit: 100 });
    if (!blobs.length) return fallback;
    const newest = blobs.reduce((a, b) => (a.uploadedAt > b.uploadedAt ? a : b));
    // cache-bust with a query string too, belt-and-suspenders against any
    // shared cache still holding an older response for this exact URL.
    const response = await fetch(`${newest.url}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json();
  } catch (error) {
    console.error(`readJson(${prefix}) failed`, error);
    return fallback;
  }
}

export async function writeJson(prefix, data) {
  const pathname = `${prefix}.${Date.now()}.json`;
  await put(pathname, JSON.stringify(data), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
  // keep only the version we just wrote — these are current-state
  // documents, not a history worth keeping around.
  try {
    const { blobs } = await list({ prefix, limit: 1000 });
    const stale = blobs.filter((blob) => blob.pathname !== pathname).map((blob) => blob.url);
    if (stale.length) await del(stale);
  } catch (error) {
    console.error(`writeJson(${prefix}) cleanup failed`, error);
  }
}
