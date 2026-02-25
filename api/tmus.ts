/**
 * Vercel serverless function: GET /api/tmus
 * Fetches daily TMUS close from Stooq (free, no API key). Returns price + % change.
 */
const STOOQ_URL = "https://stooq.com/q/d/l/?s=tmus.us&i=d";
const CACHE_SECONDS = 600; // 10 minutes

function cacheHeaders() {
  return { "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}` };
}

function parseCSV(text: string): number[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const closes: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(",");
    if (parts.length >= 5) {
      const close = parseFloat(parts[4]!);
      if (!isNaN(close)) closes.push(close);
    }
  }
  return closes;
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (!req || req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }
    const res = await fetch(STOOQ_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("Upstream error");
    const closes = parseCSV(await res.text());
    if (closes.length < 2) throw new Error("No data");
    const price = closes[closes.length - 1]!;
    const prevClose = closes[closes.length - 2]!;
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    return new Response(
      JSON.stringify({ price, prevClose, changePercent }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...cacheHeaders(),
        },
      }
    );
  } catch (err) {
    console.error("TMUS API error:", err);
    return new Response(
      JSON.stringify({ error: "Unavailable" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
