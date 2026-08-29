import { clearCookie } from '../_lib/session.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', [clearCookie('kk_admin'), clearCookie('kk_access')]);
  res.status(200).json({ ok: true });
}
