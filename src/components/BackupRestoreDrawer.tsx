import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardState } from "../types";
import * as backup from "../lib/backup";
import * as storage from "../lib/storage";
import { getShowStock, setShowStock } from "../lib/prefs";
import { boardToCanonical, validateImportFile } from "../lib/schema";
import type { BackupEntry } from "../lib/backup";
import type { PersistenceStatus } from "../hooks/usePersistence";
import { useToast } from "../contexts/ToastContext";

const COLUMN_LABELS: Record<string, string> = {
  ideas: "Ideas",
  backlog: "Backlog",
  todo: "This Week",
  wip: "Today",
  done: "Done",
};

function formatSnapshotPrimary(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

interface BackupRestoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  status: PersistenceStatus;
  currentState: BoardState;
  onRestore: (state: BoardState) => void;
  onRefreshStatus: () => void;
}

export function BackupRestoreDrawer({
  isOpen,
  onClose,
  status,
  currentState,
  onRestore,
  onRefreshStatus,
}: BackupRestoreDrawerProps) {
  const { showToast } = useToast();
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [restoreConfirm, setRestoreConfirm] = useState<BackupEntry | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<BackupEntry | null>(null);
  const [weeklyReminder, setWeeklyReminder] = useState(false);
  const [autoSaveToFile, setAutoSaveToFile] = useState(false);
  const [showStockTicker, setShowStockTickerState] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      backup.getAllBackups().then(setBackups).catch(() => setBackups([]));
      storage.getWeeklyReminderEnabled().then(setWeeklyReminder);
      storage.getAutoSaveToFileEnabled().then(setAutoSaveToFile);
      setShowStockTickerState(getShowStock());
    }
  }, [isOpen]);

  const handleExport = useCallback(() => {
    const canonical = boardToCanonical(currentState);
    const blob = new Blob([JSON.stringify(canonical, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    storage.setLastExportTime(new Date().toISOString());
    onRefreshStatus();
    showToast("Export complete", "success");
  }, [currentState, onRefreshStatus, showToast]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const text = reader.result as string;
          const data = JSON.parse(text);
          const result = validateImportFile(data);
          if (!result.valid) {
            showToast(result.error, "error");
            return;
          }
          try {
            await backup.createSnapshot(currentState, { source: "import" });
          } catch {
            showToast("Could not create snapshot before import", "error");
          }
          onRestore(result.state);
          storage.setLastExportTime(new Date().toISOString());
          onRefreshStatus();
          setBackups(await backup.getAllBackups());
          showToast("Import complete", "success");
        } catch {
          showToast("Invalid file format", "error");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [currentState, onRestore, onRefreshStatus, showToast]
  );

  const handleRestore = useCallback(
    async (entry: BackupEntry) => {
      try {
        await backup.createSnapshotBeforeRestore(
          currentState,
          entry.stateHash
        );
      } catch {
        showToast("Could not create snapshot before restore", "error");
      }
      onRestore(backup.canonicalToBoardState(entry.state));
      setRestoreConfirm(null);
      await storage.setLastRestoreTime(new Date().toISOString());
      onRefreshStatus();
      backup.getAllBackups().then(setBackups).catch(() => {});
      showToast("Restored from backup", "success");
    },
    [currentState, onRestore, onRefreshStatus, showToast]
  );

  const handleDownloadBackup = useCallback((entry: BackupEntry) => {
    const blob = new Blob([JSON.stringify(entry.state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban-backup-${entry.timestamp.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Download started", "success");
  }, [showToast]);

  const handleReset = useCallback(async () => {
    try {
      await backup.createSnapshot(currentState, { source: "reset" });
    } catch {
      showToast("Could not create snapshot before reset", "error");
    }
    const emptyState: BoardState = {
      cards: {},
      columns: currentState.columns.map((c) => ({ ...c, cardIds: [] })),
    };
    onRestore(emptyState);
    setResetConfirm(false);
    onRefreshStatus();
    setBackups(await backup.getAllBackups());
    showToast("Board reset", "success");
  }, [currentState, onRestore, onRefreshStatus, showToast]);

  const handleWeeklyReminderToggle = useCallback(async (enabled: boolean) => {
    await storage.setWeeklyReminderEnabled(enabled);
    setWeeklyReminder(enabled);
  }, []);

  const handleChooseBackupLocation = useCallback(async () => {
    if (!("showSaveFilePicker" in window)) {
      showToast("File System Access API not supported (Chrome/Edge only)", "error");
      return;
    }
    try {
      const handle = await (window as unknown as { showSaveFilePicker: (opts: { suggestedName: string; types?: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
        suggestedName: `kanban-backup-${new Date().toISOString().slice(0, 10)}.json`,
      });
      await storage.setFileHandle(handle);
      setAutoSaveToFile(true);
      showToast("Backup location set. Weekly auto-save enabled.", "success");
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        showToast("Could not save file location", "error");
      }
    }
  }, [showToast]);

  const handleClearFileHandle = useCallback(async () => {
    await storage.setFileHandle(null);
    setAutoSaveToFile(false);
    showToast("Auto-save to file disabled", "info");
  }, [showToast]);

  const handleDeleteSnapshot = useCallback(
    async (entry: BackupEntry) => {
      const ok = await backup.deleteSnapshot(entry.id);
      if (ok) {
        setBackups((prev) => prev.filter((b) => b.id !== entry.id));
        setDeleteConfirm(null);
        onRefreshStatus();
        showToast("Snapshot deleted", "success");
      } else {
        showToast("Cannot delete most recent snapshot", "error");
      }
    },
    [onRefreshStatus, showToast]
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col rounded-l-2xl border-l border-white/10 shadow-xl"
        role="dialog"
        aria-labelledby="backup-drawer-title"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="backup-drawer-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Backup & Restore
          </h2>
          <button
            onClick={onClose}
            className="rounded-full glass-pill p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Status */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
            <div className="glass space-y-2 rounded-2xl p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last saved</span>
                <span className="font-medium text-gray-900 dark:text-gray-200">{status.lastSavedAt ? formatSnapshotPrimary(status.lastSavedAt) : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last snapshot</span>
                <span className="font-medium text-gray-900 dark:text-gray-200">{status.lastSnapshotAt ? formatSnapshotPrimary(status.lastSnapshotAt) : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Last export</span>
                <span className="font-medium text-gray-900 dark:text-gray-200">{status.lastExportAt ? formatSnapshotPrimary(status.lastExportAt) : "—"}</span>
              </div>
              {status.lastRestoreAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Last restore</span>
                  <span className="font-medium text-gray-900 dark:text-gray-200">{formatSnapshotPrimary(status.lastRestoreAt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Storage mode</span>
                <span className="font-medium text-gray-900 dark:text-gray-200 capitalize">{status.storageMode}</span>
              </div>
            </div>
          </section>

          {/* Restore points */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">Restore points</h3>
            {backups.length === 0 ? (
              <div className="glass rounded-2xl border border-dashed border-white/20 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                No backups yet. Snapshots are created automatically before destructive actions.
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((entry) => (
                  <div
                    key={entry.id}
                    className="glass-card flex items-center justify-between gap-3 rounded-xl p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {entry.label}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(entry.createdAt)}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        {Object.entries(entry.columnCounts).map(([id, count]) => (
                          <span key={id}>
                            {COLUMN_LABELS[id] ?? id}: {count}
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => handleDownloadBackup(entry)}
                        className="rounded-full glass-pill px-2 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                        title="Download"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(entry)}
                        className="rounded-full p-1.5 text-gray-500 hover:bg-red-500/20 hover:text-red-500 dark:text-gray-400"
                        title="Delete"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setRestoreConfirm(entry)}
                        className="rounded-full bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white/15 dark:hover:bg-white/25"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Export / Import */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">Export / Import</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExport}
                className="rounded-full glass-pill px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-white/20 dark:text-gray-200 dark:hover:bg-white/15"
              >
                Export JSON
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full glass-pill px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-white/20 dark:text-gray-200 dark:hover:bg-white/15"
              >
                Import JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
              />
            </div>
          </section>

          {/* Weekly backup */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">Weekly backup</h3>
            <div className="glass space-y-4 rounded-2xl p-4">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Weekly export reminder</span>
                <button
                  role="switch"
                  aria-checked={weeklyReminder}
                  onClick={() => handleWeeklyReminderToggle(!weeklyReminder)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    weeklyReminder ? "bg-gray-900 dark:bg-white/30" : "bg-gray-300 dark:bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      weeklyReminder ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </label>
              {autoSaveToFile ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Auto-save to file</span>
                  <button
                    onClick={handleClearFileHandle}
                    className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Disable
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleChooseBackupLocation}
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                >
                  Choose backup location… (Chrome/Edge)
                </button>
              )}
            </div>
          </section>

          {/* Display */}
          <section className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">Display</h3>
            <div className="glass space-y-4 rounded-2xl p-4">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Show stock ticker</span>
                <button
                  role="switch"
                  aria-checked={showStockTicker}
                  onClick={() => {
                    const next = !showStockTicker;
                    setShowStockTickerState(next);
                    setShowStock(next);
                    window.dispatchEvent(new Event("kanban-prefs-changed"));
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    showStockTicker ? "bg-gray-900 dark:bg-white/30" : "bg-gray-300 dark:bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      showStockTicker ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </label>
            </div>
          </section>

          {/* Danger zone */}
          <section>
            <h3 className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">Danger zone</h3>
            <div className="rounded-2xl border border-red-300/50 bg-red-50/50 p-4 dark:border-red-500/30 dark:bg-red-950/30">
              {resetConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Reset the entire board? A snapshot will be created first.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResetConfirm(false)}
                      className="rounded-full glass-pill px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReset}
                      className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Reset board
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="rounded-full border border-red-400/50 bg-white/50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100/50 dark:border-red-500/30 dark:bg-white/5 dark:text-red-400 dark:hover:bg-red-500/20"
                >
                  Reset board
                </button>
              )}
            </div>
          </section>
        </div>
      </aside>

      {/* Restore confirm modal */}
      {restoreConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-strong mx-4 max-w-sm rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Restore backup?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {restoreConfirm.stateHash === backup.hashState(boardToCanonical(currentState))
                ? "Current state matches this snapshot. Restore anyway?"
                : "Current state will be saved as a snapshot first if different. This action cannot be undone."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setRestoreConfirm(null)}
                className="flex-1 rounded-full glass-pill py-2 text-sm font-medium text-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(restoreConfirm)}
                className="flex-1 rounded-full bg-gray-900 py-2 text-sm font-medium text-white dark:bg-white/15 dark:hover:bg-white/25"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-strong mx-4 max-w-sm rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete snapshot?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              "{deleteConfirm.label}" will be permanently deleted. This cannot be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-full glass-pill py-2 text-sm font-medium text-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSnapshot(deleteConfirm)}
                className="flex-1 rounded-full bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
