import { useEffect, useRef } from "react";
import type { Card, Priority } from "../types";
import { PRIORITY_LABELS } from "../types";

interface CardEditModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Card>) => void;
}

export function CardEditModal({
  card,
  isOpen,
  onClose,
  onSave,
}: CardEditModalProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => titleRef.current?.focus());
  }, [isOpen]);

  if (!isOpen || !card) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    onSave(card.id, {
      title: (data.get("title") as string) || card.title,
      description: (data.get("description") as string) || undefined,
      priority: (data.get("priority") as Priority) || null,
      dueDate: (data.get("dueDate") as string) || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Edit task</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={titleRef}
              name="title"
              defaultValue={card.title}
              placeholder="Task title"
              className="w-full rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <div>
            <textarea
              name="description"
              defaultValue={card.description ?? ""}
              placeholder="Description (optional)"
              rows={2}
              className="w-full resize-none rounded-xl border border-gray-300 bg-white/80 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-white/20 dark:bg-white/10 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              name="priority"
              defaultValue={card.priority ?? ""}
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
              name="dueDate"
              type="date"
              defaultValue={card.dueDate ?? ""}
              className="rounded-full glass-pill px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-gray-200"
            />
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
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white/15 dark:hover:bg-white/25"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
