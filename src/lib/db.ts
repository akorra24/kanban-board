const DB_NAME = "kanban-board";
const DB_VERSION = 2;

let db: IDBDatabase | null = null;

export function getDB(): IDBDatabase | null {
  return db;
}

export function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains("board")) {
        database.createObjectStore("board");
      }
      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta");
      }
      if (!database.objectStoreNames.contains("backups")) {
        const store = database.createObjectStore("backups", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}
