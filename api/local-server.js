/**
 * Local dev proxy for stock API. Run: node api/local-server.js
 * Or use 'vercel dev' for full local dev with serverless functions.
 */
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/TMUS";
const RANGE_MAP = {
  "1d": { interval: "15m", range: "1d" },
  "5d": { interval: "1h", range: "5d" },
  "1mo": { interval: "1d", range: "1mo" },
  "3mo": { interval: "1d", range: "3mo" },
  "6mo": { interval: "1d", range: "6mo" },
  "1y": { interval: "1d", range: "1y" },
};

async function fetchYahoo(interval, range) {
  const res = await fetch(`${YAHOO}?interval=${interval}&range=${range}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KanbanBoard/1.0)" },
  });
  return res.json();
}

const server = await import("http").then((m) => m.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== "/api/stock" || req.method !== "GET") {
    res.writeHead(404);
    res.end();
    return;
  }
  const type = url.searchParams.get("type") || "quote";
  const range = url.searchParams.get("range") || "1d";
  try {
    if (type === "quote") {
      const data = await fetchYahoo("1d", "1d");
      const r = data.chart?.result?.[0];
      const price = r?.meta?.regularMarketPrice ?? r?.meta?.chartPreviousClose;
      const prev = r?.meta?.chartPreviousClose ?? price;
      const change = price ? price - prev : 0;
      const changePercent = prev ? (change / prev) * 100 : 0;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ price, change, changePercent, updatedAt: new Date().toISOString() }));
      return;
    }
    if (type === "history") {
      const { interval, range: r } = RANGE_MAP[range] ?? RANGE_MAP["1mo"];
      const data = await fetchYahoo(interval, r);
      const result = data.chart?.result?.[0];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const points = (result?.timestamp ?? []).map((t, i) => ({ t, v: closes[i] ?? 0 })).filter((p) => p.v > 0);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(points));
      return;
    }
    res.writeHead(400);
    res.end();
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Stock data unavailable" }));
  }
}));

server.listen(3001, () => console.log("Stock API proxy: http://localhost:3001"));
