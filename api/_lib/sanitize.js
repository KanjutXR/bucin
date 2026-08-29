// Only plain http(s) URLs (Vercel Blob links) are allowed to live inside the
// small JSON documents (memories.json, doodle.json). Raw base64 data URLs
// from an older local-only version of this app must never be written here —
// a single embedded photo can make the JSON blob big enough that Vercel
// refuses to return it (FUNCTION_PAYLOAD_TOO_LARGE), breaking every GET.

export function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

export function sanitizeMemories(memories) {
  let strippedCount = 0;
  const cleaned = memories.map((memory) => {
    const media = Array.isArray(memory?.media) ? memory.media : [];
    const kept = media.filter((item) => {
      if (item && isRemoteUrl(item.dataUrl)) return true;
      strippedCount += 1;
      return false;
    });
    return { ...memory, media: kept };
  });
  return { cleaned, strippedCount };
}
