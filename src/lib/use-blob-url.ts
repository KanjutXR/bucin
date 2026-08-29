import { useEffect, useState } from 'react';
import { getRecord } from './media-db';

type BlobRecord = { id: string; blob: Blob };

/**
 * Resolves a blob stored in IndexedDB (by store name + id) into a temporary
 * object URL, revoking it automatically on cleanup / when the id changes.
 */
export function useBlobUrl(storeName: string, id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setUrl(null);
    if (!id) return;

    getRecord<BlobRecord>(storeName, id)
      .then((record) => {
        if (cancelled || !record) return;
        objectUrl = URL.createObjectURL(record.blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        // ignore — thumbnail/video just stays in a loading state
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [storeName, id]);

  return url;
}
