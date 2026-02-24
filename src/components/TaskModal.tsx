import { useEffect, useRef, useState } from "react";
import type { Card, ColumnId, Priority } from "../types";
import { COLUMN_LABELS, PRIORITY_LABELS } from "../types";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: Partial<Card> & { columnId: ColumnId }) => void;
  initialColumnId?: ColumnId;
}

export function TaskModal({
  isOpen,
  onClose,
  onSave,
  initialColumnId = "ideas",
}: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>(null);
  const [dueDate, setDueDate] = useState("");
  const [columnId, setColumnId] = useState<ColumnId>(initialColumnId);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setPriority(null);
      setDueDate("");
      setColumnId(initialColumnId);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, initialColumnId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority: priority || undefined,
      dueDate: dueDate || undefined,
      columnId,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          New task
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={priority ?? ""}
              onChange={(e) =>
                setPriority((e.target.value || null) as Priority)
              }
              className="rounded-full glass-pill px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-gray-200"
            >
              <option value="">Priority</option>
              {(Object.entries(PRIORITY_LABELS) as [Exclude<Priority, null>, string][]).map(
                ([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                )
              )}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-full glass-pill px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Column
            </label>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value as ColumnId)}
              className="w-full rounded-full glass-pill px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-gray-200"
            >
              {(
                Object.entries(COLUMN_LABELS) as [ColumnId, string][]
              ).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full glass-pill px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-white/15 dark:hover:bg-white/25"
            >
              Add task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
