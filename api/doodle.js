import { readJson, writeJson } from './_lib/blob-store.js';
import { getAuth } from './_lib/auth.js';
import { isRemoteUrl } from './_lib/sanitize.js';

const PATH = 'data/doodle';

export default async function handler(req, res) {
  const { hasAccess, isAdmin } = getAuth(req);
  if (!hasAccess) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  if (req.method === 'GET') {
    const data = await readJson(PATH, { image: null });
    res.status(200).json({ ok: true, image: data?.image ?? null });
    return;
  }

  if (req.method === 'PUT') {
    if (!isAdmin) {
      res.status(403).json({ ok: false, error: 'Khusus admin.' });
      return;
    }
    const raw = req.body?.image;
    // only a real Blob URL may be stored — a raw base64 data URL (e.g. from
    // an older local-only version of this app) would bloat this tiny JSON
    // file enough to break every GET, so it's silently ignored instead.
    const image = isRemoteUrl(raw) ? raw : null;
    await writeJson(PATH, { image });
    res.status(200).json({ ok: true, ignored: Boolean(raw) && !image });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
