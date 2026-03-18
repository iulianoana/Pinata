const DB_NAME = "spanish-quiz";
const DB_VERSION = 1;
const STORE = "attempts";

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp");
        store.createIndex("quizKey", "quizKey");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      fn(store, resolve, reject);
      t.onerror = () => reject(t.error);
    });
  });
}

export function saveAttempt(record) {
  return tx("readwrite", (store, resolve) => {
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
  }).catch((err) => {
    console.warn("Failed to save attempt:", err);
    return null;
  });
}

export function getAttempts(limit = 50) {
  return tx("readonly", (store, resolve) => {
    const idx = store.index("timestamp");
    const req = idx.openCursor(null, "prev");
    const results = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
  }).catch((err) => {
    console.warn("Failed to get attempts:", err);
    return [];
  });
}

export function deleteAttempt(id) {
  return tx("readwrite", (store, resolve) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
  }).catch((err) => {
    console.warn("Failed to delete attempt:", err);
  });
}

export function clearAllAttempts() {
  return tx("readwrite", (store, resolve) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
  }).catch((err) => {
    console.warn("Failed to clear attempts:", err);
  });
}
