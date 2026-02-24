import { useEffect, useState } from "react";

/** Logs computed glass token values to console and shows a compact panel when ?debug=1 */
export function DebugThemePanel() {
  const [show, setShow] = useState(false);
  const [tokens, setTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("debug") === "1";
    setShow(debug);

    if (!debug) return;

    const el = document.documentElement;
    const tokenKeys = [
      "--glass-bg",
      "--glass-border",
      "--glass-blur",
      "--glass-saturate",
      "--glass-strong-bg",
      "--glass-strong-blur",
      "--glass-card-bg",
      "--orb-opacity",
    ] as const;

    const readTokens = () => {
      const style = getComputedStyle(el);
      const vals: Record<string, string> = {};
      tokenKeys.forEach((cssVar) => {
        const key = cssVar.slice(2);
        try {
          vals[key] = style.getPropertyValue(cssVar).trim() || "(not set)";
        } catch {
          vals[key] = "(error)";
        }
      });
      setTokens(vals);

      const header = document.querySelector("header.glass");
      const board = document.querySelector(".kanban-board-container");
      const card = document.querySelector(".glass-card");
      const logs: string[] = ["[DebugTheme] Glass tokens:"];
      Object.entries(vals).forEach(([k, v]) => logs.push(`  ${k}: ${v}`));
      if (header) {
        const h = getComputedStyle(header);
        const webkitBf = h.getPropertyValue("-webkit-backdrop-filter") || "(none)";
        logs.push(
          "[DebugTheme] Header computed:",
          `  background: ${h.background}`,
          `  backdrop-filter: ${h.backdropFilter}`,
          `  -webkit-backdrop-filter: ${webkitBf}`,
        );
      }
      if (board) {
        const b = getComputedStyle(board);
        logs.push(
          "[DebugTheme] Board computed:",
          `  background: ${b.background}`,
          `  backdrop-filter: ${b.backdropFilter}`,
        );
      }
      if (card) {
        const c = getComputedStyle(card);
        logs.push(
          "[DebugTheme] Card computed:",
          `  background: ${c.background}`,
          `  backdrop-filter: ${c.backdropFilter}`,
        );
      }
      console.log(logs.join("\n"));
    };

    readTokens();
    const t = setTimeout(readTokens, 500);
    const observer = new MutationObserver(readTokens);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[200] glass-strong max-h-48 overflow-auto rounded-xl p-3 text-left font-mono text-[10px] tabular-nums text-gray-300"
      style={{ maxWidth: "280px" }}
    >
      <div className="mb-1 font-semibold text-white">Debug theme (prod vs dev)</div>
      <pre className="whitespace-pre-wrap break-all">
        {Object.entries(tokens).map(([k, v]) => (
          <div key={k}>
            {k}: {String(v).slice(0, 50)}
            {String(v).length > 50 ? "…" : ""}
          </div>
        ))}
      </pre>
      <button
        type="button"
        onClick={() => setShow(false)}
        className="mt-2 rounded px-2 py-0.5 text-gray-500 hover:bg-white/10"
      >
        Hide
      </button>
    </div>
  );
}
