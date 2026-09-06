// Persists a submitted quote's stored geometry (see CartLineThumbnail.tsx)
// across page loads — this site does full page navigations, no client-side
// router, so anything less than IndexedDB (a plain module-level variable, or
// sessionStorage) either resets on every navigation or can't hold binary
// data without a lossy/costly base64 round-trip. IndexedDB stores an
// ArrayBuffer natively and survives a real page reload, which is the actual
// requirement here — real report: the cart's line preview re-fetched and
// re-parsed the same file every single time the page was revisited.
//
// A quoteJob's stored file is immutable once created (see
// src/pages/api/quotes/index.ts — its fileKey/bytes are never rewritten
// after the row exists), so a cached entry never needs invalidating; it's
// only ever wrong if the quoteJobId itself no longer refers to anything,
// which just means a harmless orphaned entry, not a stale/incorrect one.
const DB_NAME = "nasap3d-quote-files";
const STORE_NAME = "files";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedQuoteFile(quoteJobId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openDb();
    return await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(quoteJobId);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Private browsing / IndexedDB disabled or unavailable — every consumer
    // just falls back to fetching fresh, no functional loss beyond losing
    // this optimization.
    return null;
  }
}

export async function setCachedQuoteFile(quoteJobId: string, buffer: ArrayBuffer): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(buffer, quoteJobId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Same as above — caching is a pure optimization, never load-bearing.
  }
}
