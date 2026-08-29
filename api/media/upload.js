import { put } from '@vercel/blob';
import { getAuth } from '../_lib/auth.js';

// NOTE: this endpoint reads the whole file into the function's request body,
// so it inherits Vercel's serverless request body limit (4.5MB on Hobby).
// That's plenty for scrapbook photos; big videos/songs may need to be
// compressed first, or this can later be swapped for @vercel/blob's
// client-side direct-upload flow if that limit becomes a problem.
//
// IMPORTANT: this requires a *public* Vercel Blob store. Vercel's newer
// dashboard defaults new stores to "Private", but private blobs need an
// authenticated proxy to display in <img>/<video> tags, which this app
// doesn't implement. Create the store with access mode "Public" instead.

async function readRawBody(req) {
  // Depending on the Vercel runtime, the body may already be buffered for
  // us (older Node runtime), or we may need to read the raw stream
  // ourselves (newer Fluid compute). Handle both.
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' && req.body.length) return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const { isAdmin } = getAuth(req);
  if (!isAdmin) {
    res.status(403).json({ ok: false, error: 'Khusus admin.' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const rawName = req.headers['x-filename'] ? decodeURIComponent(req.headers['x-filename']) : 'file';
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80) || 'file';
  const pathname = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  let body;
  try {
    body = await readRawBody(req);
  } catch (error) {
    console.error('failed to read upload body', error);
    res.status(400).json({ ok: false, error: 'Gagal membaca file yang diunggah.' });
    return;
  }

  if (!body || !body.length) {
    res.status(400).json({ ok: false, error: 'File kosong atau tidak terbaca.' });
    return;
  }

  try {
    const blob = await put(pathname, body, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });
    res.status(200).json({ ok: true, url: blob.url });
  } catch (error) {
    console.error('upload failed', error);
    const hint =
      error?.name === 'BlobAccessError'
        ? 'Blob store yang terhubung berjenis Private — buat/ganti ke store dengan akses Public.'
        : 'Gagal mengunggah file. Coba file yang lebih kecil.';
    res.status(500).json({ ok: false, error: hint });
  }
}
