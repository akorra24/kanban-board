import { useCallback, useEffect, useState } from "react";
import { getBoardTitle, setBoardTitle } from "../lib/prefs";

export function EditableBoardTitle() {
  const [title, setTitleState] = useState("");
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setTitleState(getBoardTitle());
  }, []);

  const startEdit = useCallback(() => {
    setInputValue(getBoardTitle());
    setEditing(true);
  }, []);

  const save = useCallback(() => {
    const v = inputValue.trim();
    const final = v || "Kanban Board";
    setBoardTitle(final);
    setTitleState(final);
    setEditing(false);
  }, [inputValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
      if (e.key === "Escape") {
        setInputValue(getBoardTitle());
        setEditing(false);
      }
    },
    [save]
  );

  if (editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          placeholder="Kanban Board"
          className="max-w-[240px] rounded-lg border border-gray-300 bg-white/80 px-2 py-1 text-xl font-semibold text-gray-900 focus:border-gray-400 focus:outline-none dark:border-white/20 dark:bg-white/10 dark:text-white"
          autoFocus
        />
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          Enter a name for your Kanban board (e.g., Amar&apos;s Kanban Board)
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="text-left text-xl font-semibold text-gray-900 hover:opacity-80 dark:text-white"
      title="Click to edit"
    >
      {title || "Kanban Board"}
    </button>
  );
}
