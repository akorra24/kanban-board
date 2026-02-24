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

export default async function handler(req: Request) {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker") || "TMUS";
  const range = url.searchParams.get("range") || "1d";
  const type = url.searchParams.get("type") || "quote";

  try {
    if (type === "quote") {
      const yahooUrl = `${YAHOO_CHART}?interval=1d&range=1d`;
      const res = await fetch(yahooUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Yahoo ${res.status}`);
      const data = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
          }>;
        };
      };
      const result = data.chart?.result?.[0];
      if (!result) throw new Error("No data");
      const price = result.meta?.regularMarketPrice ?? result.meta?.chartPreviousClose;
      if (price == null) throw new Error("No price");
      const prev = result.meta?.chartPreviousClose ?? price;
      const change = price - prev;
      const changePercent = prev ? (change / prev) * 100 : 0;
      return new Response(
        JSON.stringify({
          price,
          change,
          changePercent,
          updatedAt: new Date().toISOString(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...cacheHeaders(CACHE_MAX_AGE_QUOTE),
          },
        }
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
      if (!res.ok) throw new Error(`Yahoo ${res.status}`);
      const data = (await res.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: {
              quote?: Array<{ close?: (number | null)[] }>;
            };
          }>;
        };
      };
      const result = data.chart?.result?.[0];
      if (!result?.timestamp) throw new Error("No data");
      const closes = result.indicators?.quote?.[0]?.close ?? [];
      const points = result.timestamp
        .map((t, i) => ({ t, v: closes[i] ?? 0 }))
        .filter((p) => p.v > 0);
      return new Response(JSON.stringify(points), {
        headers: {
          "Content-Type": "application/json",
          ...cacheHeaders(CACHE_MAX_AGE_HISTORY),
        },
      });
    }

    return new Response("Bad request", { status: 400 });
  } catch (err) {
    console.error("Stock API error:", err);
    return new Response(
      JSON.stringify({ error: "Stock data unavailable" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
