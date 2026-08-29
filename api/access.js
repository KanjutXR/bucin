import { sign, cookieString } from './_lib/session.js';

function getQueryToken(req) {
  // don't rely on req.query being populated by the platform — parse the raw
  // URL ourselves so this works the same regardless of runtime.
  if (req.query && typeof req.query.token === 'string') return req.query.token;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

export default function handler(req, res) {
  const expected = process.env.ACCESS_KEY;
  if (!expected) {
    res.status(500).json({ ok: false, error: 'ACCESS_KEY belum diatur di Vercel.' });
    return;
  }

  const token = getQueryToken(req);
  if (!token || token !== expected) {
    res.status(401).json({ ok: false, error: 'QR code tidak valid atau sudah kedaluwarsa.' });
    return;
  }

  res.setHeader('Set-Cookie', cookieString('kk_access', sign('access'), 30 * 24 * 60 * 60));
  res.status(200).json({ ok: true });
}
