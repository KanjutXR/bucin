import { sign, cookieString } from '../_lib/session.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD belum diatur di Vercel.' });
    return;
  }

  const password = req.body?.password;
  if (!password || password !== expected) {
    res.status(401).json({ ok: false, error: 'Password admin salah.' });
    return;
  }

  const maxAge = 7 * 24 * 60 * 60;
  res.setHeader('Set-Cookie', [
    cookieString('kk_admin', sign('admin'), maxAge),
    cookieString('kk_access', sign('access'), maxAge),
  ]);
  res.status(200).json({ ok: true });
}
