import type { BoardState, Card, Column, ColumnId } from "../types";

export const SCHEMA_VERSION = 1;

export interface CanonicalState {
  version: number;
  updatedAt: string;
  columns: Column[];
  tasksById: Record<string, Card>;
  columnOrder: ColumnId[];
}

export function boardToCanonical(state: BoardState): CanonicalState {
  return {
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    columns: state.columns,
    tasksById: state.cards,
    columnOrder: state.columns.map((c) => c.id),
  };
}

export function canonicalToBoard(data: unknown): BoardState | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  // Migrate legacy format { cards, columns }
  if (d.cards && typeof d.cards === "object" && Array.isArray(d.columns)) {
    return { cards: d.cards as Record<string, Card>, columns: d.columns as Column[] };
  }

  const version = d.version;
  if (typeof version !== "number" || version > SCHEMA_VERSION) return null;

  const columns = d.columns;
  const tasksById = d.tasksById;
  if (!Array.isArray(columns) || !tasksById || typeof tasksById !== "object")
    return null;

  const validColumns: Column[] = [];
  for (const col of columns) {
    if (
      col &&
      typeof col === "object" &&
      typeof (col as Column).id === "string" &&
      typeof (col as Column).title === "string" &&
      Array.isArray((col as Column).cardIds)
    ) {
      validColumns.push(col as Column);
    }
  }

  const cards: Record<string, Card> = {};
  for (const [id, task] of Object.entries(tasksById)) {
    if (task && typeof task === "object" && isValidCard(task)) {
      cards[id] = task as Card;
    }
  }

  return {
    cards,
    columns: validColumns.length > 0 ? validColumns : getDefaultColumns(),
  };
}

function isValidCard(obj: unknown): obj is Card {
  if (!obj || typeof obj !== "object") return false;
  const t = obj as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.columnId === "string" &&
    typeof t.order === "number"
  );
}

function getDefaultColumns(): Column[] {
  const COLUMN_IDS = ["ideas", "backlog", "todo", "wip", "done"] as ColumnId[];
  const COLUMN_LABELS: Record<ColumnId, string> = {
    ideas: "Ideas",
    backlog: "Backlog",
    todo: "To Do This Week",
    wip: "Today",
    done: "Done",
  };
  return COLUMN_IDS.map((id) => ({
    id,
    title: COLUMN_LABELS[id],
    cardIds: [] as string[],
  }));
}

export function validateImportFile(data: unknown): {
  valid: true;
  state: BoardState;
} | {
  valid: false;
  error: string;
} {
  const state = canonicalToBoard(data);
  if (!state) {
    return { valid: false, error: "Invalid or corrupted file format" };
  }
  const canonical = boardToCanonical(state);
  if (canonical.version > SCHEMA_VERSION) {
    return { valid: false, error: "File was created with a newer app version" };
  }
  return { valid: true, state };
}
