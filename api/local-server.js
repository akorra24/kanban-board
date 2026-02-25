/**
 * Local dev proxy for stock API. Run: node api/local-server.js
 * Uses Stooq (same as Vercel /api/stock). Set VITE_STOCK_API_URL=http://localhost:3001 for dev.
 */
const STOOQ_URL = "https://stooq.com/q/d/l/?s=tmus.us&i=d";

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 5) {
      const date = parts[0].trim();
      const close = parseFloat(parts[4]);
      if (date && !isNaN(close)) rows.push({ date, close });
    }
  }
  return rows;
}

const server = await import("http").then((m) =>
  m.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/api/stock" || req.method !== "GET") {
      res.writeHead(404);
      res.end();
      return;
    }
    const range = url.searchParams.get("range") || "1m";
    const limitMap = { "7d": 7, "1m": 30, "3m": 90, "6m": 180, "12m": 365 };
    const limit = limitMap[range] ?? 30;
    try {
      const r = await fetch(STOOQ_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)" },
      });
      if (!r.ok) throw new Error("Upstream error");
      const text = await r.text();
      const all = parseCSV(text);
      if (all.length < 2) throw new Error("No data");
      const history = all.slice(-limit);
      const currentPrice = history[history.length - 1].close;
      const previousClose = history[history.length - 2]?.close ?? currentPrice;
      const changePercent = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      });
      res.end(
        JSON.stringify({
          currentPrice,
          previousClose,
          changePercent,
          history: history.map(({ date, close }) => ({ date, close })),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Stock data unavailable" }));
    }
  })
);

server.listen(3001, () => console.log("Stock API (Stooq): http://localhost:3001"));
