const DB_NAME = 'socialsquare-e2ee';

function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('keys')) {
                db.createObjectStore('keys');
            }
            if (!db.objectStoreNames.contains('media')) {
                db.createObjectStore('media');
            }
            if (!db.objectStoreNames.contains('cache')) {
                db.createObjectStore('cache');
            }
            if (!db.objectStoreNames.contains('drafts')) {
                db.createObjectStore('drafts');
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function performOp(storeName, mode, callback) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const req = callback(store);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => reject(req.error);
    });
}

export const dbService = {
    // Keys Store
    get: (key) => performOp('keys', 'readonly', s => s.get(key)),
    set: (key, val) => performOp('keys', 'readwrite', s => s.put(val, key)),
    remove: (key) => performOp('keys', 'readwrite', s => s.delete(key)),

    // Media Blobs Store
    getMedia: (key) => performOp('media', 'readonly', s => s.get(key)),
    setMedia: (key, val) => performOp('media', 'readwrite', s => s.put(val, key)),
    removeMedia: (key) => performOp('media', 'readwrite', s => s.delete(key)),

    // Cache Store (Feeds, Chat Histories)
    getCache: (key) => performOp('cache', 'readonly', s => s.get(key)),
    setCache: (key, val) => performOp('cache', 'readwrite', s => s.put(val, key)),
    removeCache: (key) => performOp('cache', 'readwrite', s => s.delete(key)),

    // Drafts Store
    getDraft: (key) => performOp('drafts', 'readonly', s => s.get(key)),
    setDraft: (key, val) => performOp('drafts', 'readwrite', s => s.put(val, key)),
    removeDraft: (key) => performOp('drafts', 'readwrite', s => s.delete(key)),
};

export default dbService;
