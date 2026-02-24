const KEY_CITY = "kanban-city";
const KEY_USE_LOCATION = "kanban-use-location";
const KEY_BOARD_TITLE = "kanban-board-title";
const KEY_SHOW_STOCK = "kanban-show-stock";
const DEFAULT_TITLE = "Kanban Board";

export function getCity(): string {
  try {
    return localStorage.getItem(KEY_CITY) ?? "";
  } catch {
    return "";
  }
}

export function setCity(city: string): void {
  try {
    localStorage.setItem(KEY_CITY, city.trim());
    localStorage.setItem(KEY_USE_LOCATION, "false");
  } catch {
    // ignore
  }
}

export function getUseLocation(): boolean {
  try {
    return localStorage.getItem(KEY_USE_LOCATION) === "true";
  } catch {
    return false;
  }
}

export function setUseLocation(use: boolean): void {
  try {
    localStorage.setItem(KEY_USE_LOCATION, String(use));
  } catch {
    // ignore
  }
}

export function getBoardTitle(): string {
  try {
    const t = localStorage.getItem(KEY_BOARD_TITLE)?.trim();
    return t || DEFAULT_TITLE;
  } catch {
    return DEFAULT_TITLE;
  }
}

export function setBoardTitle(title: string): void {
  try {
    const t = title.trim();
    localStorage.setItem(KEY_BOARD_TITLE, t || DEFAULT_TITLE);
  } catch {
    // ignore
  }
}

export function getShowStock(): boolean {
  try {
    const v = localStorage.getItem(KEY_SHOW_STOCK);
    return v !== "false";
  } catch {
    return true;
  }
}

export function setShowStock(show: boolean): void {
  try {
    localStorage.setItem(KEY_SHOW_STOCK, String(show));
  } catch {
    // ignore
  }
}
