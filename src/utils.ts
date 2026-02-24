import type { Card, ColumnId } from "./types";

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function reorderCards(cards: Card[], columnId: ColumnId): Card[] {
  return cards
    .filter((c) => c.columnId === columnId)
    .sort((a, b) => a.order - b.order)
    .map((c, i) => ({ ...c, order: i }));
}
