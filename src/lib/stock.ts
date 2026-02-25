const API_BASE = import.meta.env.VITE_STOCK_API_URL ?? "";
const STORAGE_KEY = "kanban-tmus";

export interface TMUSQuote {
  price: number;
  prevClose: number;
  changePercent: number;
}

async function apiFetch(path: string): Promise<Response> {
  const url = `${API_BASE}${path}`;
  return fetch(url, { signal: AbortSignal.timeout(10000) });
}

function getCached(): TMUSQuote | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TMUSQuote;
  } catch {
    return null;
  }
}

function setCached(data: TMUSQuote): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export async function fetchTMUS(): Promise<TMUSQuote | null> {
  try {
    const res = await apiFetch("/api/tmus");
    if (!res.ok) return getCached();
    const data = (await res.json()) as TMUSQuote;
    if (typeof data?.price !== "number" || typeof data?.changePercent !== "number") return getCached();
    setCached(data);
    return data;
  } catch {
    return getCached();
  }
}

export function getCachedTMUS(): TMUSQuote | null {
  return getCached();
}
