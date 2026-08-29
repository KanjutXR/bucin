import { parseCookies, verify } from './_lib/session.js';

export default function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const isAdmin = verify(cookies.kk_admin, 'admin');
  const hasAccess = isAdmin || verify(cookies.kk_access, 'access');
  res.status(200).json({ hasAccess, isAdmin });
}
