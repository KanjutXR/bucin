import crypto from 'crypto';

const DAY = 24 * 60 * 60 * 1000;

function getSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.ACCESS_KEY ||
    'kenangan-game-kita-fallback-secret'
  );
}

export function sign(role, ttlMs = 30 * DAY) {
  const expires = Date.now() + ttlMs;
  const payload = `${role}.${expires}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verify(token, expectedRole) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [role, expires, sig] = parts;
  if (role !== expectedRole) return false;
  if (!expires || Date.now() > Number(expires)) return false;
  const payload = `${role}.${expires}`;
  const expectedSig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

export function cookieString(name, value, maxAgeSec) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secure}`;
}

export function clearCookie(name) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
