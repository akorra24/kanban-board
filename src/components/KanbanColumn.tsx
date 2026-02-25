import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, ColumnId } from "../types";
import { CardItem } from "./CardItem";

interface KanbanColumnProps {
  columnId: ColumnId;
  title: string;
  cards: Card[];
  isDone: boolean;
  canAddToThisWeek: boolean;
  onAddCard: () => void;
  onDeleteCard: (id: string) => void;
  onAddToThisWeek: (id: string) => void;
  onEditCard: (id: string) => void;
  onViewDetail: (id: string) => void;
  onClearDone?: () => void;
}

export function KanbanColumn({
  columnId,
  title,
  cards,
  isDone,
  canAddToThisWeek,
  onAddCard,
  onDeleteCard,
  onAddToThisWeek,
  onEditCard,
  onViewDetail,
  onClearDone,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-0 w-full min-w-0 flex-col rounded-2xl glass transition-all duration-200 ${
        isOver ? "ring-2 ring-indigo-400/50 ring-offset-2 ring-offset-transparent" : ""
      }`}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-2xl border-b border-gray-200 px-4 py-3 dark:border-white/10">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-gray-200/80 px-2 text-xs font-medium text-gray-600 dark:bg-white/10 dark:text-gray-300">
          {cards.length}
        </span>
      </div>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              canAddToThisWeek={canAddToThisWeek}
              onDelete={onDeleteCard}
              onAddToThisWeek={onAddToThisWeek}
              onEdit={onEditCard}
              onViewDetail={onViewDetail}
            />
          ))}
          <button
            onClick={onAddCard}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:border-white/20 dark:text-gray-400 dark:hover:border-white/30 dark:hover:bg-white/5 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add card
          </button>
          {isDone && onClearDone && cards.length > 0 && (
            <button
              onClick={onClearDone}
              className="mt-2 rounded-xl glass-pill py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Clear Done
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
