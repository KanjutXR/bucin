import { handleUpload } from '@vercel/blob/client';
import { getAuth } from '../_lib/auth.js';

// This used to accept the raw file straight in the function's request body,
// which meant every upload counted against Vercel's serverless request-body
// limit (4.5MB on Hobby) — any real video or long song blew past that and
// failed with FUNCTION_PAYLOAD_TOO_LARGE. This endpoint now only hands out a
// short-lived, admin-scoped upload token; the browser then PUTs the actual
// file bytes straight to Vercel Blob, bypassing this function (and its size
// limit) entirely. See the matching client-side change in `uploadFile()`
// inside src/App.tsx, which now calls `upload()` from `@vercel/blob/client`
// instead of POSTing the file here.
//
// IMPORTANT: this still requires a *public* Vercel Blob store — private
// blobs need an authenticated proxy to display in <img>/<video>, which this
// app doesn't implement. Create the store with access mode "Public".

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

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/*', 'video/*', 'audio/*'],
        addRandomSuffix: false,
        maximumSizeInBytes: 200 * 1024 * 1024, // 200MB, well above what a phone photo/clip needs
      }),
      onUploadCompleted: async () => {
        // nothing to persist here — the client saves the resulting blob URL
        // into the memory/song record itself once upload() resolves.
      },
    });
    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('upload token generation failed', error);
    const hint =
      error?.name === 'BlobAccessError'
        ? 'Blob store yang terhubung berjenis Private — buat/ganti ke store dengan akses Public.'
        : error?.message || 'Gagal menyiapkan upload. Coba lagi.';
    res.status(400).json({ ok: false, error: hint });
  }
}
