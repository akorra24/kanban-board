import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ColumnId } from "../types";
import { KanbanColumn } from "./KanbanColumn";
import { TaskModal } from "./TaskModal";
import { CardEditModal } from "./CardEditModal";
import { CardDetailPanel } from "./CardDetailPanel";
import { BackupRestoreDrawer } from "./BackupRestoreDrawer";
import { CityTemperatureWidget } from "./CityTemperatureWidget";
import { ConfettiBurst } from "./ConfettiBurst";
import { DebugThemePanel } from "./DebugThemePanel";
import { EditableBoardTitle } from "./EditableBoardTitle";
import { TMUSStockWidget } from "./TMUSStockWidget";
import { useBoard } from "../hooks/useBoard";
import { usePersistence } from "../hooks/usePersistence";
import { useToast } from "../contexts/ToastContext";
import { useTheme } from "../contexts/ThemeContext";
import type { Card } from "../types";
import type { Priority } from "../types";
import * as backup from "../lib/backup";
import * as storage from "../lib/storage";
import { boardToCanonical } from "../lib/schema";

const PRIMARY_COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "To Do This Week" },
  { id: "wip", title: "Today" },
  { id: "done", title: "Done" },
];

const IDEAS_COLUMN = { id: "ideas" as ColumnId, title: "Ideas" };

const ALL_COLUMNS = [IDEAS_COLUMN, ...PRIMARY_COLUMNS];

function formatSavedTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 5000) return "Just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const SIX_HOURS = 6 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export function KanbanBoard() {
  const { showToast } = useToast();
  const {
    state,
    replaceState,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    moveCardWithinOrAcross,
    addToThisWeek,
    clearDone,
    wipCount,
  } = useBoard();

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<"all" | Exclude<Priority, null>>("all");
  const [backupDrawerOpen, setBackupDrawerOpen] = useState(false);
  const [clearDoneConfirm, setClearDoneConfirm] = useState(false);
  const [weeklyReminderBanner, setWeeklyReminderBanner] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const { status, refreshStatus } = usePersistence(state, () => {
    showToast("Persistence failing — check storage or use a different browser", "error");
  });

  useEffect(() => {
    let cancelled = false;
    storage.initStorage().then(() => {
      if (cancelled) return;
      return storage.loadBoard();
    }).then((loaded) => {
      if (!cancelled && loaded) {
        replaceState(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [replaceState]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const checkWeekly = async () => {
      const lastExport = await storage.getLastExportTime();
      const snoozeUntil = await storage.getSnoozeUntil();
      const now = Date.now();
      if (snoozeUntil && new Date(snoozeUntil).getTime() > now) return;
      const exportDue = !lastExport || now - new Date(lastExport).getTime() > SEVEN_DAYS;

      const hasFileHandle = await storage.getAutoSaveToFileEnabled();
      if (hasFileHandle && exportDue) {
        const canonical = boardToCanonical(stateRef.current);
        const ok = await storage.tryWriteBackupToFile(canonical);
        if (ok) {
          refreshStatus();
          return;
        }
      }

      const reminderEnabled = await storage.getWeeklyReminderEnabled();
      if (reminderEnabled && exportDue) {
        setWeeklyReminderBanner(true);
      }
    };
    checkWeekly();
    interval = setInterval(checkWeekly, SIX_HOURS);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        storage.getWeeklyReminderEnabled().then((enabled) => {
          if (enabled) {
            storage.getLastExportTime().then((lastExport) => {
              storage.getSnoozeUntil().then((snoozeUntil) => {
                const now = Date.now();
                if (snoozeUntil && new Date(snoozeUntil).getTime() > now) return;
                if (!lastExport || now - new Date(lastExport).getTime() > SEVEN_DAYS) {
                  setWeeklyReminderBanner(true);
                }
              });
            });
          }
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const card = state.cards[active.id as string];
    if (card) setActiveCard(card);
  }, [state.cards]);

  const handleNewTask = useCallback(
    (card: Partial<Card> & { columnId: ColumnId }) => {
      addCard(card.columnId, card);
    },
    [addCard]
  );

  const handleClearDoneConfirm = useCallback(async () => {
    try {
      await backup.createSnapshot(state);
    } catch {
      showToast("Could not create snapshot", "error");
    }
    clearDone();
    setClearDoneConfirm(false);
    refreshStatus();
    showToast("Cleared Done column", "success");
  }, [state, clearDone, refreshStatus, showToast]);

  const renderColumn = useCallback(
    (
      { id, title }: { id: ColumnId; title: string },
      canAddToThisWeek: boolean,
      isDone: boolean
    ) => {
      const column = state.columns.find((c) => c.id === id);
      const cardIds = column?.cardIds ?? [];
      const allCards = cardIds
        .map((cid) => state.cards[cid])
        .filter(Boolean) as Card[];
      const filteredCards =
        priorityFilter === "all"
          ? allCards
          : allCards.filter((c) => c.priority === priorityFilter);

      return (
        <KanbanColumn
          key={id}
          columnId={id}
          title={title}
          cards={filteredCards}
          isDone={isDone}
          canAddToThisWeek={canAddToThisWeek}
          onAddCard={() => addCard(id)}
          onDeleteCard={deleteCard}
          onAddToThisWeek={addToThisWeek}
          onEditCard={(id) => setEditCardId(id)}
          onViewDetail={(id) => setDetailCardId(id)}
          onClearDone={
            isDone
              ? () => setClearDoneConfirm(true)
              : undefined
          }
        />
      );
    },
    [
      state.columns,
      state.cards,
      priorityFilter,
      addCard,
      deleteCard,
      addToThisWeek,
    ]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over) return;

      const activeCardData = state.cards[active.id as string];
      if (!activeCardData) return;

      const overCard = state.cards[over.id as string];
      const overColumn = ALL_COLUMNS.find((c) => c.id === over.id);
      const targetColumnId = overCard?.columnId ?? overColumn?.id;

      if (targetColumnId === "done" && activeCardData.columnId !== "done") {
        setShowConfetti(true);
      }

      if (overCard) {
        moveCardWithinOrAcross(
          active.id as string,
          over.id as string,
          activeCardData.columnId
        );
      } else if (overColumn) {
        const column = state.columns.find((c) => c.id === overColumn.id);
        if (column) {
          moveCard(active.id as string, overColumn.id, column.cardIds.length);
        }
      }
    },
    [state.cards, state.columns, moveCardWithinOrAcross, moveCard]
  );

  const handleSnoozeReminder = useCallback(async () => {
    await storage.setSnoozeUntil(
      new Date(Date.now() + ONE_DAY).toISOString()
    );
    setWeeklyReminderBanner(false);
  }, []);

  const handleExportFromBanner = useCallback(() => {
    setWeeklyReminderBanner(false);
    const canonical = boardToCanonical(state);
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
    refreshStatus();
    showToast("Export complete", "success");
  }, [state, refreshStatus, showToast]);

  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="min-h-screen overflow-x-hidden bg-base bg-orbs">
      <div className="noise" aria-hidden="true" />
      {status.saveFailed && (
        <div className="relative z-10 glass mx-4 mt-4 rounded-2xl px-4 py-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200">
          Persistence failing — data may not be saved. Check storage or try a different browser.
        </div>
      )}

      {weeklyReminderBanner && (
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 glass mx-4 mt-4 rounded-2xl px-4 py-3">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Weekly backup ready — export now
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleSnoozeReminder}
              className="rounded-full glass-pill px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors dark:text-gray-300 dark:hover:text-white"
            >
              Later
            </button>
            <button
              onClick={handleExportFromBanner}
              className="rounded-full bg-emerald-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500/80 transition-colors"
            >
              Export
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 glass border-0 rounded-none">
        <div className="relative z-10 mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <CityTemperatureWidget />
            <span className="hidden text-gray-300 dark:text-gray-600 sm:inline" aria-hidden>|</span>
            <EditableBoardTitle />
            <span className="hidden text-gray-300 dark:text-gray-600 sm:inline" aria-hidden>|</span>
            <TMUSStockWidget />
            <span className="hidden text-gray-300 dark:text-gray-600 sm:inline" aria-hidden>|</span>
            <span
              className="text-xs text-gray-500 dark:text-gray-400"
              title={`Last saved: ${status.lastSavedAt ?? "—"}`}
            >
              Saved • {formatSavedTime(status.lastSavedAt)}
            </span>
            {status.lastRestoreAt && (
              <span
                className="text-xs text-gray-500 dark:text-gray-400"
                title={`Last restore: ${status.lastRestoreAt}`}
              >
                Last restore • {formatSavedTime(status.lastRestoreAt)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
              className="rounded-full glass-pill p-2.5 text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-white"
              title={theme === "system" ? "Theme: System" : theme === "dark" ? "Theme: Dark" : "Theme: Light"}
            >
              {resolvedTheme === "dark" ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            {wipCount > 3 && (
              <span className="inline-flex items-center gap-1.5 rounded-full glass-pill px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {wipCount} Today (consider limiting to 3)
              </span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Filter</span>
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as "all" | Exclude<Priority, null>)
                }
                className="rounded-full glass-pill px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-gray-200"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <button
              onClick={() => setBackupDrawerOpen(true)}
              className="rounded-full glass-pill p-2.5 text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-white"
              title="Backup & Restore"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-white/15 dark:hover:bg-white/25 dark:focus:ring-white/30"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New task <kbd className="rounded bg-gray-700 px-1.5 py-0.5 text-xs dark:bg-white/20">N</kbd>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl overflow-x-hidden px-4 py-6 sm:px-6">
        <div className="glass kanban-board-container rounded-3xl p-4 md:p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 overflow-hidden md:grid-cols-[repeat(4,minmax(0,1fr))] md:gap-6">
            {PRIMARY_COLUMNS.map((col) =>
              renderColumn(col, col.id === "backlog", col.id === "done")
            )}
            <div className="min-w-0 md:col-span-1">
              {renderColumn(IDEAS_COLUMN, true, false)}
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 200 }}>
            {activeCard ? (
              <div className="glass-strong rounded-2xl p-4 shadow-xl">
                <span className="font-medium text-gray-900 dark:text-white">{activeCard.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        </div>
      </main>

      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleNewTask}
      />

      <CardEditModal
        card={editCardId ? state.cards[editCardId] ?? null : null}
        isOpen={!!editCardId}
        onClose={() => setEditCardId(null)}
        onSave={(id, updates) => {
          updateCard(id, updates);
          setEditCardId(null);
        }}
      />

      <CardDetailPanel
        card={detailCardId ? state.cards[detailCardId] ?? null : null}
        isOpen={!!detailCardId}
        onClose={() => setDetailCardId(null)}
        onUpdate={updateCard}
        onEditInModal={(id) => setEditCardId(id)}
        onDelete={deleteCard}
      />

      <BackupRestoreDrawer
        isOpen={backupDrawerOpen}
        onClose={() => setBackupDrawerOpen(false)}
        status={status}
        currentState={state}
        onRestore={replaceState}
        onRefreshStatus={refreshStatus}
      />

      {clearDoneConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-strong mx-4 max-w-sm rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clear Done column?</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              A snapshot will be created first. All cards in Done will be removed.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setClearDoneConfirm(false)}
                className="flex-1 rounded-full glass-pill py-2 text-sm font-medium text-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleClearDoneConfirm}
                className="flex-1 rounded-full bg-gray-900 py-2 text-sm font-medium text-white dark:bg-white/15 dark:hover:bg-white/25"
              >
                Clear Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfetti && (
        <ConfettiBurst
          duration={600}
          onComplete={() => setShowConfetti(false)}
        />
      )}

      <DebugThemePanel />
      <KeyboardShortcut keyCode="KeyN" onActivate={() => setModalOpen(true)} />
    </div>
  );
}

function KeyboardShortcut({
  keyCode,
  onActivate,
}: {
  keyCode: string;
  onActivate: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === keyCode && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();
        onActivate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyCode, onActivate]);
  return null;
}
