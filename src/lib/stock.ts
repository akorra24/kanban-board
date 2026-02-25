const API_BASE = import.meta.env.VITE_STOCK_API_URL ?? "";
const STORAGE_KEY = "kanban-tmus-stock";

export type StockRange = "7d" | "1m" | "3m" | "6m" | "12m";

export interface StockData {
  currentPrice: number;
  previousClose: number;
  changePercent: number;
  history: { date: string; close: number }[];
  updatedAt: string;
}

export interface StockChartPoint {
  t: number;
  v: number;
}

async function apiFetch(path: string): Promise<Response> {
  const url = `${API_BASE}${path}`;
  return fetch(url, { signal: AbortSignal.timeout(10000) });
}

function getCached(): StockData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StockData;
  } catch {
    return null;
  }
}

function setCached(data: StockData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function fetchTMUSStock(range: StockRange = "1m"): Promise<StockData | null> {
  try {
    const res = await apiFetch(`/api/stock?range=${range}`);
    if (!res.ok) return null;
    const data = (await res.json()) as StockData;
    if (
      typeof data?.currentPrice !== "number" ||
      !Array.isArray(data?.history)
    )
      return null;
    setCached(data);
    return data;
  } catch {
    return getCached();
  }
}

export function getCachedTMUSStock(): StockData | null {
  return getCached();
}

export const RANGE_LABELS: Record<StockRange, string> = {
  "7d": "7D",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "12m": "12M",
};

export function getRangeLabel(r: StockRange): string {
  return RANGE_LABELS[r];
}
