export type ColumnId =
  | "ideas"
  | "backlog"
  | "todo"
  | "wip"
  | "done";

export type Priority = "low" | "medium" | "high" | null;

export interface Card {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
  columnId: ColumnId;
  order: number;
  completedAt?: string;
}

export interface Column {
  id: ColumnId;
  title: string;
  cardIds: string[];
}

export interface BoardState {
  cards: Record<string, Card>;
  columns: Column[];
}

export const COLUMN_IDS: ColumnId[] = [
  "ideas",
  "backlog",
  "todo",
  "wip",
  "done",
];

export const COLUMN_LABELS: Record<ColumnId, string> = {
  ideas: "Ideas",
  backlog: "Backlog",
  todo: "To Do This Week",
  wip: "Today",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Exclude<Priority, null>, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
