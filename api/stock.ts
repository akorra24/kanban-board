/**
 * Vercel serverless function: /api/stock
 * Proxies Yahoo Finance data (no CORS). Deploy to Vercel for stock data.
 */
const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/TMUS";

const RANGE_MAP: Record<string, { interval: string; range: string }> = {
  "1d": { interval: "15m", range: "1d" },
  "5d": { interval: "1h", range: "5d" },
  "1mo": { interval: "1d", range: "1mo" },
  "3mo": { interval: "1d", range: "3mo" },
  "6mo": { interval: "1d", range: "6mo" },
  "1y": { interval: "1d", range: "1y" },
};

const CACHE_MAX_AGE_QUOTE = 60;
const CACHE_MAX_AGE_HISTORY = 900;

function cacheHeaders(maxAge: number) {
  return {
    "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge}`,
  };
}

function jsonResponse(data: unknown, status: number, maxAge?: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(maxAge != null ? cacheHeaders(maxAge) : {}),
    },
  });
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
    const range = url.searchParams.get("range") || "1d";
    const type = url.searchParams.get("type") || "quote";

    if (type === "quote") {
      const yahooUrl = `${YAHOO_CHART}?interval=1d&range=1d`;
      const res = await fetch(yahooUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return jsonResponse({ error: "Upstream error" }, 502);
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        return jsonResponse({ error: "Invalid upstream response" }, 502);
      }
      const chart = data && typeof data === "object" && "chart" in data ? (data as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }> } }).chart : undefined;
      const result = chart?.result?.[0];
      if (!result?.meta) return jsonResponse({ error: "No data" }, 502);
      const price = result.meta.regularMarketPrice ?? result.meta.chartPreviousClose;
      if (price == null) return jsonResponse({ error: "No price" }, 502);
      const prev = result.meta.chartPreviousClose ?? price;
      const change = price - prev;
      const changePercent = prev ? (change / prev) * 100 : 0;
      return jsonResponse(
        { price, change, changePercent, updatedAt: new Date().toISOString() },
        200,
        CACHE_MAX_AGE_QUOTE
      );
    }

    if (type === "history") {
      const { interval, range: r } = RANGE_MAP[range] ?? RANGE_MAP["1mo"];
      const yahooUrl = `${YAHOO_CHART}?interval=${interval}&range=${r}`;
      const res = await fetch(yahooUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return jsonResponse({ error: "Upstream error" }, 502);
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        return jsonResponse({ error: "Invalid upstream response" }, 502);
      }
      const chart = data && typeof data === "object" && "chart" in data ? (data as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> }).chart : undefined;
      const result = chart?.result?.[0];
      const timestamp = result?.timestamp;
      if (!Array.isArray(timestamp) || timestamp.length === 0) return jsonResponse({ error: "No data" }, 502);
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const points = timestamp
        .map((t: number, i: number) => ({ t, v: closes[i] ?? 0 }))
        .filter((p: { t: number; v: number }) => p.v > 0);
      return jsonResponse(points, 200, CACHE_MAX_AGE_HISTORY);
    }

    return jsonResponse({ error: "Bad request" }, 400);
  } catch (err) {
    console.error("Stock API error:", err);
    return jsonResponse({ error: "Stock data unavailable" }, 502);
  }
}
