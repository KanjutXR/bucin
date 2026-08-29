import { clearCookie } from '../_lib/session.js';

// Logging out of admin mode should only drop the *admin* privileges — not
// the guest access that QR scan already granted on this device. The old
// version cleared both `kk_admin` and `kk_access` here, so right after an
// admin logged out, that same phone would be fully locked out again (even
// though it had already scanned the QR before). Re-entering required
// re-scanning the QR from scratch, because the `?access=...` token in the
// URL gets stripped right after it's first used — so simply reopening the
// tab/bookmark afterwards had no token left to re-grant access with.
export default function handler(req, res) {
  res.setHeader('Set-Cookie', [clearCookie('kk_admin')]);
  res.status(200).json({ ok: true });
}
