import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardState } from "../types";
import * as backup from "../lib/backup";
import * as storage from "../lib/storage";

const DEBOUNCE_MS = 400;

export interface PersistenceStatus {
  lastSavedAt: string | null;
  lastSnapshotAt: string | null;
  lastExportAt: string | null;
  lastRestoreAt: string | null;
  storageMode: storage.StorageMode;
  saveFailed: boolean;
}

export function usePersistence(
  state: BoardState,
  onSaveFailed: () => void
) {
  const [status, setStatus] = useState<PersistenceStatus>({
    lastSavedAt: null,
    lastSnapshotAt: null,
    lastExportAt: null,
    lastRestoreAt: null,
    storageMode: "indexeddb",
    saveFailed: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(
    async (stateToSave: BoardState) => {
      const ok = await storage.saveBoard(stateToSave);
      if (!ok) {
        onSaveFailed();
        setStatus((s) => ({ ...s, saveFailed: true }));
        return;
      }
      setStatus((s) => ({
        ...s,
        lastSavedAt: new Date().toISOString(),
        saveFailed: false,
      }));
    },
    [onSaveFailed]
  );

  const scheduleSave = useCallback(
    (stateToSave: BoardState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        performSave(stateToSave);
      }, DEBOUNCE_MS);
    },
    [performSave]
  );

  useEffect(() => {
    scheduleSave(state);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [state, scheduleSave]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        performSave(state);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [state, performSave]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mode = await storage.initStorage();
        if (cancelled) return;
        setStatus((s) => ({ ...s, storageMode: mode }));

        const [lastSave, lastSnapshot, lastExport, lastRestore] = await Promise.all([
          storage.getLastSaveTime(),
          backup.getLastSnapshotTime(),
          storage.getLastExportTime(),
          storage.getLastRestoreTime(),
        ]);
        if (cancelled) return;
        setStatus((s) => ({
          ...s,
          lastSavedAt: lastSave ?? s.lastSavedAt,
          lastSnapshotAt: lastSnapshot,
          lastExportAt: lastExport,
          lastRestoreAt: lastRestore,
        }));
      } catch {
        if (!cancelled) setStatus((s) => ({ ...s, storageMode: "localstorage" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    const [lastSave, lastSnapshot, lastExport, lastRestore] = await Promise.all([
      storage.getLastSaveTime(),
      backup.getLastSnapshotTime(),
      storage.getLastExportTime(),
      storage.getLastRestoreTime(),
    ]);
    setStatus((s) => ({
      ...s,
      lastSavedAt: lastSave ?? s.lastSavedAt,
      lastSnapshotAt: lastSnapshot,
      lastExportAt: lastExport,
      lastRestoreAt: lastRestore,
      storageMode: storage.getStorageMode(),
    }));
  }, []);

  return { status, refreshStatus, performSave };
}
