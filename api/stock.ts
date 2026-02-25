/**
 * Vercel serverless function: /api/stock
 * Fetches TMUS daily data from Stooq (free, no API key). Parses CSV and returns JSON.
 * Server-side cache: 5 minutes.
 */
const STOOQ_URL = "https://stooq.com/q/d/l/?s=tmus.us&i=d";
const CACHE_SECONDS = 300; // 5 minutes

const RANGE_LIMITS: Record<string, number> = {
  "7d": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "12m": 365,
};

function cacheHeaders() {
  return { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` };
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...cacheHeaders(),
    },
  });
}

function parseCSV(text: string): { date: string; close: number }[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const rows: { date: string; close: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(",");
    if (parts.length >= 5) {
      const date = parts[0]!.trim();
      const close = parseFloat(parts[4]!);
      if (date && !isNaN(close)) rows.push({ date, close });
    }
  }
  return rows;
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (!req || req.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
    const rawUrl = typeof req.url === "string" ? req.url : "";
    const url = rawUrl.startsWith("http")
      ? new URL(rawUrl)
      : new URL(rawUrl || "/", "https://" + (req.headers?.get?.("host") ?? "localhost"));
    const range = url.searchParams.get("range") || "1m";

    const res = await fetch(STOOQ_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return jsonResponse({ error: "Upstream error" }, 502);
    const text = await res.text();
    const all = parseCSV(text);
    if (all.length < 2) return jsonResponse({ error: "No data" }, 502);

    const limit = RANGE_LIMITS[range] ?? 30;
    const history = all.slice(-limit);
    const currentPrice = history[history.length - 1]!.close;
    const previousClose = history.length >= 2 ? history[history.length - 2]!.close : currentPrice;
    const changePercent = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

    return jsonResponse(
      {
        currentPrice,
        previousClose,
        changePercent,
        history: history.map(({ date, close }) => ({ date, close })),
        updatedAt: new Date().toISOString(),
      },
      200
    );
  } catch (err) {
    console.error("Stock API error:", err);
    return jsonResponse({ error: "Stock data unavailable" }, 502);
  }
}
