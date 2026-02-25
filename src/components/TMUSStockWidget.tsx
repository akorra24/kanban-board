import { useCallback, useEffect, useRef, useState } from "react";
import * as stock from "../lib/stock";
import { getShowStock } from "../lib/prefs";

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function MiniChart({ points }: { points: { t: number; v: number }[] }) {
  if (points.length < 2) return null;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 200;
  const h = 80;
  const padding = 4;
  const path = points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (w - 2 * padding);
      const y = h - padding - ((p.v - min) / range) * (h - 2 * padding);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const isUp = vals[vals.length - 1]! >= vals[0]!;
  return (
    <svg width={w} height={h} className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TMUSStockWidget() {
  const [show, setShow] = useState(() => getShowStock());
  const [data, setData] = useState<stock.StockData | null>(() => stock.getCachedTMUSStock());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [range, setRange] = useState<stock.StockRange>("1m");
  const [chartData, setChartData] = useState<stock.StockData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setShow(getShowStock());
    window.addEventListener("kanban-prefs-changed", handler);
    return () => window.removeEventListener("kanban-prefs-changed", handler);
  }, []);

  const fetchStock = useCallback(async (r?: stock.StockRange) => {
    const rng = r ?? range;
    const result = await stock.fetchTMUSStock(rng);
    setData(result);
    setError(!result);
    setLoading(false);
    return result;
  }, [range]);

  useEffect(() => {
    if (!show) return;
    const refresh = () => {
      if (document.visibilityState === "visible") fetchStock();
    };
    refresh();
    const t = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [show, fetchStock]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    if (panelOpen) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [panelOpen]);

  const fetchChart = useCallback(async (r: stock.StockRange) => {
    setChartLoading(true);
    const result = await stock.fetchTMUSStock(r);
    setChartData(result ?? null);
    setChartLoading(false);
  }, []);

  useEffect(() => {
    if (panelOpen && show) {
      fetchChart(range);
    }
  }, [panelOpen, range, show, fetchChart]);

  if (!show) return null;

  const display =
    loading || error
      ? "TMUS —"
      : data
        ? `TMUS $${data.currentPrice.toFixed(2)} ${data.changePercent >= 0 ? "▲" : "▼"}${Math.abs(data.changePercent).toFixed(1)}%`
        : "TMUS unavailable";

  const isUp = data ? data.changePercent >= 0 : true;

  const chartSource = chartData ?? data;
  const chartPoints: { t: number; v: number }[] =
    chartSource?.history?.map(({ date, close }) => ({
      t: new Date(date).getTime(),
      v: close,
    })) ?? [];
  const minMax =
    chartPoints.length >= 2
      ? {
          min: Math.min(...chartPoints.map((p) => p.v)),
          max: Math.max(...chartPoints.map((p) => p.v)),
          pct:
            (((chartPoints[chartPoints.length - 1]!.v - chartPoints[0]!.v) / chartPoints[0]!.v) * 100).toFixed(1),
        }
      : null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full glass-pill px-3 py-1.5 text-sm tabular-nums transition-colors hover:bg-white/20 dark:hover:bg-white/15 ${
          isUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
        }`}
        title={data ? `Last updated ${formatTime(data.updatedAt)}` : "TMUS stock"}
      >
        {display}
      </button>
      {panelOpen && (
        <div className="glass-strong absolute right-0 top-full z-50 mt-2 w-72 rounded-xl p-4 shadow-xl">
          <div className="mb-3 flex gap-2">
            {(["7d", "1m", "3m", "6m", "12m"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  range === r
                    ? "bg-gray-900 text-white dark:bg-white/20 dark:text-white"
                    : "glass-pill text-gray-600 dark:text-gray-400"
                }`}
              >
                {stock.getRangeLabel(r)}
              </button>
            ))}
          </div>
          {chartLoading ? (
            <div className="flex h-20 items-center justify-center text-sm text-gray-500">
              Loading…
            </div>
          ) : chartPoints.length >= 2 ? (
            <>
              <MiniChart points={chartPoints} />
              {minMax && (
                <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Min ${minMax.min.toFixed(2)}</span>
                  <span className={Number(minMax.pct) >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {minMax.pct}%
                  </span>
                  <span>Max ${minMax.max.toFixed(2)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-20 items-center justify-center text-sm text-gray-500">
              TMUS unavailable
            </div>
          )}
        </div>
      )}
    </div>
  );
}
