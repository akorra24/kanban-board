/**
 * Local dev proxy for TMUS API. Run: node api/local-server.js
 * Set VITE_STOCK_API_URL=http://localhost:3001 for dev.
 */
const STOOQ_URL = "https://stooq.com/q/d/l/?s=tmus.us&i=d";

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const closes = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    if (parts.length >= 5) {
      const close = parseFloat(parts[4]);
      if (!isNaN(close)) closes.push(close);
    }
  }
  return closes;
}

const server = await import("http").then((m) =>
  m.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== "/api/tmus" || req.method !== "GET") {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const r = await fetch(STOOQ_URL, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)" },
      });
      if (!r.ok) throw new Error("Upstream error");
      const closes = parseCSV(await r.text());
      if (closes.length < 2) throw new Error("No data");
      const price = closes[closes.length - 1];
      const prevClose = closes[closes.length - 2];
      const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600",
      });
      res.end(JSON.stringify({ price, prevClose, changePercent }));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unavailable" }));
    }
  })
);

server.listen(3001, () => console.log("TMUS API (Stooq): http://localhost:3001"));
