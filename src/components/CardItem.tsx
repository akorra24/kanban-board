import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Card as CardType, Priority } from "../types";
import { PRIORITY_LABELS } from "../types";

interface CardItemProps {
  card: CardType;
  canAddToThisWeek: boolean;
  onDelete: (id: string) => void;
  onAddToThisWeek: (id: string) => void;
  onEdit: (id: string) => void;
  onViewDetail: (id: string) => void;
}

const priorityColors: Record<Exclude<Priority, null>, string> = {
  low: "bg-emerald-500 dark:bg-emerald-400",
  medium: "bg-amber-500 dark:bg-amber-400",
  high: "bg-rose-500 dark:bg-rose-400",
};

export function CardItem({
  card,
  canAddToThisWeek,
  onDelete,
  onAddToThisWeek,
  onEdit,
  onViewDetail,
}: CardItemProps) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityStripeClass = card.priority ? priorityColors[card.priority] : "";
  const contentPadding = card.priority ? "pl-5" : "";

  const isCompleted = card.columnId === "done";

  const handleCardActivate = () => onViewDetail(card.id);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardActivate();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`View ${card.title || "Untitled"} task details`}
      onClick={handleCardActivate}
      onKeyDown={handleKeyDown}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl glass-card transition-all duration-[180ms] ease-out hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:ring-white/20 motion-reduce:translate-y-0 dark:hover:ring-white/15 ${
        isDragging ? "opacity-95 shadow-xl ring-2 ring-indigo-400/50" : ""
      } ${isCompleted ? "opacity-80" : ""}`}
    >
      {/* Priority color stripe - visible left bar */}
      {card.priority && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${priorityStripeClass}`}
          aria-hidden
        />
      )}
      <div
        className={`relative rounded-2xl p-4 ${contentPadding} ${
          isCompleted && card.completedAt ? "kanban-card-completed" : ""
        }`}
      >
        <div className="flex items-start gap-2">
        {isCompleted && (
          <span
            className="mt-1 shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 dark:bg-emerald-500/30 dark:text-emerald-400"
            aria-hidden
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 shrink-0 cursor-grab rounded p-1 text-gray-500 hover:bg-gray-200/80 hover:text-gray-700 active:cursor-grabbing dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-300"
          aria-label="Drag to reorder"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2h2zM15 2a2 2 0 012 2v12a2 2 0 01-2 2h-2a2 2 0 01-2-2V4a2 2 0 012-2h2z" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 rounded-lg text-left">
          <span className={`block text-sm font-medium text-gray-900 dark:text-gray-100 ${isCompleted ? "opacity-90" : ""}`}>
            {card.title || "Untitled"}
          </span>
          {(card.description || card.priority || card.dueDate) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {card.priority && (
                <span className="inline-flex items-center rounded-md bg-gray-200/80 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-white/15 dark:text-gray-300">
                  {PRIORITY_LABELS[card.priority]}
                </span>
              )}
              {card.dueDate && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(card.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
          {card.description && (
            <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {card.description}
            </p>
          )}
          {isCompleted && card.completedAt && (
            <p className="absolute bottom-3 right-4 text-[10px] text-gray-500 dark:text-gray-500">
              {new Date(card.completedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(card.id);
            }}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-200/80 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-300"
            title="Edit"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {canAddToThisWeek && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToThisWeek(card.id);
              }}
              className="rounded p-1.5 text-gray-500 hover:bg-amber-200/80 hover:text-amber-700 dark:hover:bg-amber-500/20 dark:hover:text-amber-400"
              title="Add to This Week"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            className="rounded p-1.5 text-gray-500 hover:bg-red-200/80 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400"
            title="Delete"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
