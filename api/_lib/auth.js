import { parseCookies, verify } from './session.js';

export function getAuth(req) {
  const cookies = parseCookies(req.headers.cookie);
  const isAdmin = verify(cookies.kk_admin, 'admin');
  const hasAccess = isAdmin || verify(cookies.kk_access, 'access');
  return { hasAccess, isAdmin };
}
