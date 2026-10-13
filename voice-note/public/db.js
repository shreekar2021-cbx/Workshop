let database;
export function openDB() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open('voice-notebook', 1);
    request.onupgradeneeded = () => {
      for (const store of ['notes', 'drafts', 'recordings', 'reports']) request.result.createObjectStore(store, { keyPath: 'id' });
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = null; }; resolve(request.result); };
    request.onerror = () => { database = null; reject(new Error('Browser storage is unavailable. Enable storage to save your notes.')); };
    request.onblocked = () => reject(new Error('Close other notebook tabs and reload to update browser storage.'));
  });
  return database;
}
export async function transact(store, method, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, method === 'getAll' || method === 'get' ? 'readonly' : 'readwrite');
    const request = tx.objectStore(store)[method](value);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(new Error('Your changes could not be saved. Check available browser storage and try again.'));
  });
}
export async function commitTranscript(draft, segment) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(['drafts','recordings'],'readwrite');
    tx.objectStore('drafts').put(draft);
    tx.objectStore('recordings').delete(segment.id);
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(new Error('Transcription could not be saved locally. The audio is kept for retry.'));
  });
}
