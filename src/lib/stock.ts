const API_BASE = import.meta.env.VITE_STOCK_API_URL ?? "";

export type StockRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";

export interface StockQuote {
  price: number;
  change: number;
  changePercent: number;
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

export async function fetchTMUSQuote(): Promise<StockQuote | null> {
  try {
    const res = await apiFetch("/api/stock?ticker=TMUS&type=quote");
    if (!res.ok) return null;
    const data = (await res.json()) as StockQuote;
    return data.price != null ? data : null;
  } catch {
    return null;
  }
}

export async function fetchTMUSHistory(range: StockRange): Promise<StockChartPoint[] | null> {
  try {
    const res = await apiFetch(`/api/stock?ticker=TMUS&type=history&range=${range}`);
    if (!res.ok) return null;
    const data = (await res.json()) as StockChartPoint[];
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

const RANGE_LABELS: Record<StockRange, string> = {
  "1d": "24H",
  "5d": "7D",
  "1mo": "1M",
  "3mo": "3M",
  "6mo": "6M",
  "1y": "12M",
};

export function getRangeLabel(r: StockRange): string {
  return RANGE_LABELS[r];
}
