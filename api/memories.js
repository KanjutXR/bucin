import { readJson, writeJson } from './_lib/blob-store.js';
import { getAuth } from './_lib/auth.js';
import { sanitizeMemories } from './_lib/sanitize.js';

const PATH = 'data/memories';

export default async function handler(req, res) {
  const { hasAccess, isAdmin } = getAuth(req);
  if (!hasAccess) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  if (req.method === 'GET') {
    const memories = await readJson(PATH, null);
    res.status(200).json({ ok: true, memories });
    return;
  }

  if (req.method === 'PUT') {
    if (!isAdmin) {
      res.status(403).json({ ok: false, error: 'Khusus admin.' });
      return;
    }
    const memories = req.body?.memories;
    if (!Array.isArray(memories)) {
      res.status(400).json({ ok: false, error: 'Data kenangan tidak valid.' });
      return;
    }
    // never let raw base64 images slip into the JSON index — see sanitize.js
    const { cleaned, strippedCount } = sanitizeMemories(memories);
    await writeJson(PATH, cleaned);
    res.status(200).json({ ok: true, strippedCount });
    return;
  }

  res.status(405).json({ ok: false, error: 'Method not allowed' });
}
