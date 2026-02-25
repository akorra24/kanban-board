import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Priority } from "../types";
import { COLUMN_LABELS, PRIORITY_LABELS } from "../types";

interface CardDetailPanelProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Card>) => void;
  onEditInModal: (id: string) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_STYLES: Record<Exclude<Priority, null>, string> = {
  low: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-rose-600 dark:text-rose-400",
};

export function CardDetailPanel({
  card,
  isOpen,
  onClose,
  onUpdate,
  onEditInModal,
  onDelete,
}: CardDetailPanelProps) {
  const [titleValue, setTitleValue] = useState(card?.title ?? "");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleValue(card?.title ?? "");
    setIsEditingTitle(false);
  }, [card?.id, card?.title]);

  useEffect(() => {
    if (isOpen && isEditingTitle) {
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
  }, [isOpen, isEditingTitle]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditingTitle) {
          setTitleValue(card?.title ?? "");
          setIsEditingTitle(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handler);
    }
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, isEditingTitle, card?.title, onClose]);

  const handleTitleBlur = useCallback(() => {
    if (!card) return;
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== card.title) {
      onUpdate(card.id, { title: trimmed });
    } else {
      setTitleValue(card.title);
    }
    setIsEditingTitle(false);
  }, [card, titleValue, onUpdate]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTitleBlur();
      }
    },
    [handleTitleBlur]
  );

  const handleDelete = useCallback(() => {
    if (card) {
      onDelete(card.id);
      onClose();
    }
  }, [card, onDelete, onClose]);

  const [isSlidIn, setIsSlidIn] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setIsSlidIn(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsSlidIn(true));
      });
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop: dimmed, blurred, click to close */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel: slide in from right */}
      <aside
        className="glass-strong fixed right-0 top-0 z-50 flex h-full w-[min(100%,28rem)] max-w-[45vw] flex-col border-l border-white/10 shadow-xl transition-transform duration-[220ms] ease-out sm:w-[min(100%,32rem)]"
        style={{
          transform: isSlidIn ? "translateX(0)" : "translateX(100%)",
        }}
        role="dialog"
        aria-labelledby="card-detail-title"
        aria-modal="true"
      >
        {card ? (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <button
                onClick={onClose}
                className="rounded-full p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditInModal(card.id)}
                  className="rounded-full glass-pill px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white/20 dark:text-gray-200 dark:hover:bg-white/15"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-full px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
              <div className="mx-auto max-w-[45rem]">
                {/* Title - large, editable */}
                <div className="mb-6">
                  {isEditingTitle ? (
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onBlur={handleTitleBlur}
                      onKeyDown={handleTitleKeyDown}
                      className="w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 text-xl font-semibold text-gray-900 placeholder-gray-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder-gray-400"
                      placeholder="Task title"
                    />
                  ) : (
                    <h1
                      id="card-detail-title"
                      onClick={() => setIsEditingTitle(true)}
                      className="cursor-pointer rounded-lg py-1 text-xl font-semibold leading-tight text-gray-900 transition-colors hover:bg-white/20 dark:text-white dark:hover:bg-white/10 sm:text-2xl"
                    >
                      {card.title || "Untitled"}
                    </h1>
                  )}
                </div>

                {/* Metadata row */}
                <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Priority</span>
                    <span className={`ml-2 font-medium ${card.priority ? PRIORITY_STYLES[card.priority] : "text-gray-600 dark:text-gray-300"}`}>
                      {card.priority ? PRIORITY_LABELS[card.priority] : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Status</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-200">
                      {COLUMN_LABELS[card.columnId] ?? card.columnId}
                    </span>
                  </div>
                  {card.dueDate && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Due</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-gray-200">
                        {new Date(card.dueDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  {card.columnId === "done" && card.completedAt && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Completed</span>
                      <span className="ml-2 font-medium text-gray-600 dark:text-gray-300">
                        {new Date(card.completedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description - readable typography */}
                {card.description ? (
                  <section>
                    <h2 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </h2>
                    <div
                      className="card-detail-description max-w-[40rem] whitespace-pre-wrap text-[15px]"
                      style={{ lineHeight: 1.6 }}
                    >
                      {card.description}
                    </div>
                  </section>
                ) : (
                  <section>
                    <h2 className="mb-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Description
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                      No description. Click Edit to add one.
                    </p>
                  </section>
                )}
              </div>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
