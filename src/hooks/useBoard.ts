import { useCallback, useState } from "react";
import type { BoardState, Card, ColumnId } from "../types";
import { COLUMN_IDS, COLUMN_LABELS } from "../types";
import { generateId } from "../utils";

const initialColumns = COLUMN_IDS.map((id) => ({
  id,
  title: COLUMN_LABELS[id],
  cardIds: [] as string[],
}));

const emptyState: BoardState = {
  cards: {},
  columns: initialColumns,
};

export function useBoard() {
  const [state, setState] = useState<BoardState>(emptyState);

  const replaceState = useCallback((newState: BoardState) => {
    setState(newState);
  }, []);

  const addCard = useCallback((columnId: ColumnId, card?: Partial<Card>) => {
    const id = card?.id ?? generateId();

    setState((prev) => {
      const column = prev.columns.find((c) => c.id === columnId);
      const order = column ? column.cardIds.length : 0;
      const newCard: Card = {
        id,
        title: card?.title ?? "New task",
        description: card?.description,
        priority: card?.priority ?? null,
        dueDate: card?.dueDate,
        columnId,
        order,
        ...(columnId === "done" ? { completedAt: new Date().toISOString() } : {}),
      };
      const cards = { ...prev.cards, [id]: newCard };
      const columns = prev.columns.map((col) =>
        col.id === columnId
          ? { ...col, cardIds: [...col.cardIds, id] }
          : col
      );
      return { cards, columns };
    });
    return id;
  }, []);

  const updateCard = useCallback((id: string, updates: Partial<Card>) => {
    setState((prev) => {
      const card = prev.cards[id];
      if (!card) return prev;
      return {
        ...prev,
        cards: { ...prev.cards, [id]: { ...card, ...updates } },
      };
    });
  }, []);

  const deleteCard = useCallback((id: string) => {
    setState((prev) => {
      const card = prev.cards[id];
      if (!card) return prev;
      const { [id]: _, ...cards } = prev.cards;
      const columns = prev.columns.map((col) =>
        col.id === card.columnId
          ? { ...col, cardIds: col.cardIds.filter((cid) => cid !== id) }
          : col
      );
      return { cards, columns };
    });
  }, []);

  const moveCard = useCallback(
    (cardId: string, targetColumnId: ColumnId, targetIndex: number) => {
      setState((prev) => {
        const card = prev.cards[cardId];
        if (!card || card.columnId === targetColumnId) return prev;
        const now = new Date().toISOString();
        const updates: Partial<Card> = { columnId: targetColumnId };
        if (targetColumnId === "done") updates.completedAt = now;
        else if (card.columnId === "done") updates.completedAt = undefined;
        const cards = { ...prev.cards, [cardId]: { ...card, ...updates } };
        const columns = prev.columns.map((col) => {
          const without = col.cardIds.filter((id) => id !== cardId);
          if (col.id === targetColumnId) {
            const before = without.slice(0, targetIndex);
            const after = without.slice(targetIndex);
            return { ...col, cardIds: [...before, cardId, ...after] };
          }
          return { ...col, cardIds: without };
        });
        return { cards, columns };
      });
    },
    []
  );

  const reorderInColumn = useCallback(
    (columnId: ColumnId, activeId: string, overId: string) => {
      setState((prev) => {
        const column = prev.columns.find((c) => c.id === columnId);
        if (!column) return prev;

        const oldIndex = column.cardIds.indexOf(activeId);
        const newIndex = column.cardIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;

        const cardIds = [...column.cardIds];
        cardIds.splice(oldIndex, 1);
        const insertIndex = oldIndex < newIndex ? newIndex - 1 : newIndex;
        cardIds.splice(insertIndex, 0, activeId);

        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === columnId ? { ...col, cardIds } : col
          ),
        };
      });
    },
    []
  );

  const moveCardWithinOrAcross = useCallback(
    (activeId: string, overId: string | null, activeColumnId: ColumnId) => {
      if (!overId) return;

      const overCard = state.cards[overId];
      const overColumn = state.columns.find((c) => c.cardIds.includes(overId));

      if (overCard && overColumn) {
        if (overColumn.id === activeColumnId) {
          reorderInColumn(activeColumnId, activeId, overId);
        } else {
          const targetIndex = overColumn.cardIds.indexOf(overId);
          moveCard(activeId, overColumn.id, targetIndex);
        }
      }
    },
    [state.cards, state.columns, reorderInColumn, moveCard]
  );

  const addToThisWeek = useCallback((cardId: string) => {
    const card = state.cards[cardId];
    if (!card) return;
    moveCard(cardId, "todo", 0);
  }, [state.cards, moveCard]);

  const clearDone = useCallback(() => {
    setState((prev) => {
      const doneColumn = prev.columns.find((c) => c.id === "done");
      if (!doneColumn) return prev;

      const cards = { ...prev.cards };
      doneColumn.cardIds.forEach((id) => delete cards[id]);

      const columns = prev.columns.map((col) =>
        col.id === "done" ? { ...col, cardIds: [] } : col
      );
      return { cards, columns };
    });
  }, []);

  const wipCount = state.columns.find((c) => c.id === "wip")?.cardIds.length ?? 0;

  return {
    state,
    replaceState,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    moveCardWithinOrAcross,
    reorderInColumn,
    addToThisWeek,
    clearDone,
    wipCount,
  };
}
