import type { BoardState } from "../types";
import { boardToCanonical, type CanonicalState } from "./schema";
import { hashState } from "./hash";
import { openDB } from "./db";

const STORE_BACKUPS = "backups";
const STORE_META = "meta";
const KEY_LAST_SNAPSHOT = "lastSnapshot";

const MAX_TOTAL = 50;

export type SnapshotSource = "auto" | "restore" | "reset" | "import" | "manual";

export interface BackupEntry {
  id: string;
  timestamp: string;
  createdAt: string;
  label: string;
  source: SnapshotSource;
  stateHash: string;
  state: CanonicalState;
  columnCounts: Record<string, number>;
}

function ensureEntry(raw: unknown): BackupEntry {
  const e = raw as Record<string, unknown>;
  const timestamp = (e.timestamp ?? e.createdAt ?? "") as string;
  const state = e.state as CanonicalState | undefined;
  return {
    id: (e.id ?? "") as string,
    timestamp,
    createdAt: (e.createdAt ?? timestamp) as string,
    label: (e.label ?? formatSnapshotLabel(timestamp)) as string,
    source: (e.source ?? "manual") as SnapshotSource,
    stateHash: (e.stateHash ?? (state ? hashState(state) : "")) as string,
    state: state ?? { version: 1, updatedAt: "", columns: [], tasksById: {}, columnOrder: [] },
    columnCounts: (e.columnCounts ?? getColumnCountsFromState(state)) as Record<string, number>,
  };
}

function formatSnapshotLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPreRestoreLabel(): string {
  const d = new Date();
  const date = d.toISOString().slice(0, 10);
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `Auto backup (before restore) – ${date} ${time}`;
}

async function ensureDB(): Promise<IDBDatabase> {
  return openDB();
}

function getColumnCounts(state: BoardState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const col of state.columns) {
    counts[col.id] = col.cardIds.length;
  }
  return counts;
}

function getColumnCountsFromState(canonical: CanonicalState | undefined): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!canonical?.columns) return counts;
  for (const col of canonical.columns) {
    counts[col.id] = col.cardIds.length;
  }
  return counts;
}

export async function createSnapshot(
  state: BoardState,
  options?: { label?: string; source?: SnapshotSource }
): Promise<BackupEntry> {
  const database = await ensureDB();
  const canonical = boardToCanonical(state);
  const stateHash = hashState(canonical);
  const id = `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const timestamp = canonical.updatedAt;

  const label = options?.label ?? formatSnapshotLabel(timestamp);
  const source = options?.source ?? "manual";

  const entry: BackupEntry = {
    id,
    timestamp,
    createdAt: timestamp,
    label,
    source,
    stateHash,
    state: canonical,
    columnCounts: getColumnCounts(state),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction([STORE_BACKUPS, STORE_META], "readwrite");
    tx.objectStore(STORE_BACKUPS).add(entry);
    tx.objectStore(STORE_META).put(entry.timestamp, KEY_LAST_SNAPSHOT);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await pruneBackups(database);
  return entry;
}

export async function createSnapshotBeforeRestore(
  currentState: BoardState,
  targetStateHash: string
): Promise<BackupEntry | null> {
  const canonical = boardToCanonical(currentState);
  const currentHash = hashState(canonical);
  if (currentHash === targetStateHash) return null;

  return createSnapshot(currentState, {
    label: formatPreRestoreLabel(),
    source: "restore",
  });
}

async function pruneBackups(database: IDBDatabase): Promise<void> {
  const all = await getAllBackupsInternal(database);
  if (all.length <= MAX_TOTAL) return;

  const sorted = [...all].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const toConsider = sorted.slice(1);

  const byDate = new Map<string, BackupEntry>();
  for (const e of toConsider) {
    const dateKey = e.createdAt.slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, e);
  }
  const dailyIds = new Set(Array.from(byDate.values()).map((e) => e.id));

  const nonDaily = toConsider.filter((e) => !dailyIds.has(e.id));
  const daily = toConsider.filter((e) => dailyIds.has(e.id));

  nonDaily.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  daily.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const toDelete: BackupEntry[] = [];
  let deleted = 0;
  const needToDelete = all.length - MAX_TOTAL;

  for (const e of nonDaily) {
    if (deleted >= needToDelete) break;
    toDelete.push(e);
    deleted++;
  }
  for (const e of daily) {
    if (deleted >= needToDelete) break;
    toDelete.push(e);
    deleted++;
  }

  if (toDelete.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_BACKUPS, "readwrite");
      for (const e of toDelete) {
        tx.objectStore(STORE_BACKUPS).delete(e.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function deleteSnapshot(id: string): Promise<boolean> {
  try {
    const database = await ensureDB();
    const all = await getAllBackupsInternal(database);
    const mostRecent = all[0];
    if (mostRecent?.id === id) return false;

    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_BACKUPS, "readwrite");
      tx.objectStore(STORE_BACKUPS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

async function getAllBackupsInternal(
  database: IDBDatabase
): Promise<BackupEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_BACKUPS, "readonly");
    const req = tx.objectStore(STORE_BACKUPS).getAll();
    req.onsuccess = () => {
      const raw = (req.result as unknown[]) ?? [];
      const list = raw.map(ensureEntry).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllBackups(): Promise<BackupEntry[]> {
  try {
    const database = await ensureDB();
    return getAllBackupsInternal(database);
  } catch {
    return [];
  }
}

export async function getBackupById(id: string): Promise<BackupEntry | null> {
  try {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_BACKUPS, "readonly");
      const req = tx.objectStore(STORE_BACKUPS).get(id);
      req.onsuccess = () => {
        const raw = req.result;
        resolve(raw ? ensureEntry(raw) : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function getLastSnapshotTime(): Promise<string | null> {
  try {
    const database = await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_META, "readonly");
      const req = tx.objectStore(STORE_META).get(KEY_LAST_SNAPSHOT);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export { hashState };

export function canonicalToBoardState(state: CanonicalState): BoardState {
  return {
    cards: state.tasksById,
    columns: state.columns,
  };
}
