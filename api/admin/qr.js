import { parseCookies, verify } from '../_lib/session.js';

export default function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  if (!verify(cookies.kk_admin, 'admin')) {
    res.status(403).json({ ok: false, error: 'Khusus admin.' });
    return;
  }

  const accessKey = process.env.ACCESS_KEY;
  if (!accessKey) {
    res.status(500).json({ ok: false, error: 'ACCESS_KEY belum diatur di Vercel.' });
    return;
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `${proto}://${host}/?access=${encodeURIComponent(accessKey)}`;
  res.status(200).json({ ok: true, url });
}
