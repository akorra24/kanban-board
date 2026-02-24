import type { BoardState } from "../types";
import { boardToCanonical, canonicalToBoard } from "./schema";
import { openDB } from "./db";

const STORE_BOARD = "board";
const STORE_META = "meta";
const KEY_BOARD = "state";
const KEY_LAST_SAVE = "lastSave";
const KEY_LAST_EXPORT = "lastExport";
const KEY_WEEKLY_REMINDER = "weeklyReminder";
const KEY_SNOOZE_UNTIL = "snoozeUntil";
const KEY_FILE_HANDLE = "fileHandle";
const KEY_LAST_RESTORE = "lastRestore";
const LOCALSTORAGE_FALLBACK_KEY = "kanban-board-state-v2";

export type StorageMode = "indexeddb" | "localstorage";

let storageMode: StorageMode = "indexeddb";

async function ensureDB(): Promise<IDBDatabase> {
  return openDB();
}

export async function initStorage(): Promise<StorageMode> {
  try {
    await ensureDB();
    storageMode = "indexeddb";
    return "indexeddb";
  } catch {
    storageMode = "localstorage";
    return "localstorage";
  }
}

export function getStorageMode(): StorageMode {
  return storageMode;
}

export async function loadBoard(): Promise<BoardState | null> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_BOARD, "readonly");
        const store = tx.objectStore(STORE_BOARD);
        const req = store.get(KEY_BOARD);
        req.onsuccess = () => {
          const data = req.result;
          resolve(data ? canonicalToBoard(data) : null);
        };
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    storageMode = "localstorage";
  }

  try {
    let stored = localStorage.getItem(LOCALSTORAGE_FALLBACK_KEY);
    if (!stored) {
      stored = localStorage.getItem("kanban-board-state");
    }
    if (stored) {
      const parsed = JSON.parse(stored);
      return canonicalToBoard(parsed);
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveBoard(state: BoardState): Promise<boolean> {
  const canonical = boardToCanonical(state);

  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction([STORE_BOARD, STORE_META], "readwrite");
        const boardStore = tx.objectStore(STORE_BOARD);
        const metaStore = tx.objectStore(STORE_META);
        boardStore.put(canonical, KEY_BOARD);
        metaStore.put(canonical.updatedAt, KEY_LAST_SAVE);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    }
  } catch {
    storageMode = "localstorage";
  }

  try {
    localStorage.setItem(LOCALSTORAGE_FALLBACK_KEY, JSON.stringify(canonical));
    return true;
  } catch {
    return false;
  }
}

export async function getLastSaveTime(): Promise<string | null> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get(KEY_LAST_SAVE);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getLastExportTime(): Promise<string | null> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get(KEY_LAST_EXPORT);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    // ignore
  }
  return localStorage.getItem("kanban-last-export") ?? null;
}

export async function setLastExportTime(iso: string): Promise<void> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readwrite");
        tx.objectStore(STORE_META).put(iso, KEY_LAST_EXPORT);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // ignore
  }
  try {
    localStorage.setItem("kanban-last-export", iso);
  } catch {
    // ignore
  }
}

export async function getWeeklyReminderEnabled(): Promise<boolean> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get(KEY_WEEKLY_REMINDER);
        req.onsuccess = () => resolve(req.result === true);
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    // ignore
  }
  return localStorage.getItem("kanban-weekly-reminder") === "true";
}

export async function setWeeklyReminderEnabled(enabled: boolean): Promise<void> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readwrite");
        tx.objectStore(STORE_META).put(enabled, KEY_WEEKLY_REMINDER);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // ignore
  }
  localStorage.setItem("kanban-weekly-reminder", String(enabled));
}

export async function getSnoozeUntil(): Promise<string | null> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get(KEY_SNOOZE_UNTIL);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    // ignore
  }
  return localStorage.getItem("kanban-snooze-until");
}

export async function setSnoozeUntil(iso: string | null): Promise<void> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readwrite");
        if (iso) {
          tx.objectStore(STORE_META).put(iso, KEY_SNOOZE_UNTIL);
        } else {
          tx.objectStore(STORE_META).delete(KEY_SNOOZE_UNTIL);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // ignore
  }
  if (iso) localStorage.setItem("kanban-snooze-until", iso);
  else localStorage.removeItem("kanban-snooze-until");
}

// File System Access API
export async function getFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get(KEY_FILE_HANDLE);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    // ignore
  }
  return null;
}

export async function tryWriteBackupToFile(
  state: { version: number; updatedAt: string; columns: unknown; tasksById: unknown; columnOrder: unknown }
): Promise<boolean> {
  try {
    const handle = await getFileHandle();
    if (!handle) return false;
    const writable = await (handle as FileSystemFileHandle & { createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }).createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    await setLastExportTime(new Date().toISOString());
    return true;
  } catch {
    return false;
  }
}

export async function setFileHandle(
  handle: FileSystemFileHandle | null
): Promise<void> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readwrite");
        if (handle) {
          tx.objectStore(STORE_META).put(handle, KEY_FILE_HANDLE);
        } else {
          tx.objectStore(STORE_META).delete(KEY_FILE_HANDLE);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // ignore
  }
}

export async function getAutoSaveToFileEnabled(): Promise<boolean> {
  const handle = await getFileHandle();
  return !!handle;
}

export async function getLastRestoreTime(): Promise<string | null> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readonly");
        const req = tx.objectStore(STORE_META).get(KEY_LAST_RESTORE);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    }
  } catch {
    // ignore
  }
  return localStorage.getItem("kanban-last-restore");
}

export async function setLastRestoreTime(iso: string): Promise<void> {
  try {
    if (storageMode === "indexeddb") {
      const database = await ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_META, "readwrite");
        tx.objectStore(STORE_META).put(iso, KEY_LAST_RESTORE);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch {
    // ignore
  }
  localStorage.setItem("kanban-last-restore", iso);
}

