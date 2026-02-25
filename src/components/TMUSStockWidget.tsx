import { useCallback, useEffect, useState } from "react";
import * as stock from "../lib/stock";
import { getShowStock } from "../lib/prefs";

const REFRESH_MS = 10 * 60 * 1000; // 10 minutes

export function TMUSStockWidget() {
  const [show, setShow] = useState(() => getShowStock());
  const [data, setData] = useState<stock.TMUSQuote | null>(() => stock.getCachedTMUS());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handler = () => setShow(getShowStock());
    window.addEventListener("kanban-prefs-changed", handler);
    return () => window.removeEventListener("kanban-prefs-changed", handler);
  }, []);

  const refresh = useCallback(async () => {
    const result = await stock.fetchTMUS();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [show, refresh]);

  if (!show) return null;

  const hasData = data && typeof data.price === "number";
  const display = hasData
    ? `TMUS $${data.price.toFixed(2)} ${data.changePercent >= 0 ? "▲" : "▼"}${Math.abs(data.changePercent).toFixed(1)}%`
    : "TMUS —";
  const isUp = hasData ? data.changePercent >= 0 : true;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full glass-pill px-3 py-1.5 text-sm tabular-nums ${
        isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
      title={loading ? "Loading…" : hasData ? `Last close: $${data.prevClose.toFixed(2)}` : "No data"}
    >
      {display}
    </span>
  );
}
