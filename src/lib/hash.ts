import type { CanonicalState } from "./schema";

export function hashState(state: CanonicalState): string {
  const payload = {
    columns: state.columns,
    tasksById: state.tasksById,
    columnOrder: state.columnOrder,
  };
  const str = JSON.stringify(payload);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return Math.abs(h).toString(36);
}
