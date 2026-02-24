const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const IP_GEO_URL = "https://ip-api.com/json/?fields=city,regionName,status";
const CACHE_MINUTES = 45;

/** Infer city from IP (no permission prompt). Returns null on failure. */
export async function fetchCityFromIP(): Promise<string | null> {
  try {
    const res = await fetch(IP_GEO_URL, { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { status?: string; city?: string; regionName?: string };
    if (data.status !== "success" || !data.city) return null;
    return data.city;
  } catch {
    return null;
  }
}

export interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export async function geocodeCity(name: string): Promise<GeocodeResult | null> {
  if (!name.trim()) return null;
  try {
    const res = await fetch(
      `${GEOCODING_URL}?name=${encodeURIComponent(name.trim())}&count=1`
    );
    const data = (await res.json()) as { results?: GeocodeResult[] };
    return data.results?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchTemperature(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(
      `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m`
    );
    const data = (await res.json()) as { current?: { temperature_2m?: number } };
    const tempC = data.current?.temperature_2m;
    return tempC != null ? Math.round((tempC * 9) / 5 + 32) : null;
  } catch {
    return null;
  }
}

export interface CachedTemp {
  tempF: number;
  fetchedAt: string;
}

export function getCachedTemp(city: string): CachedTemp | null {
  try {
    const raw = localStorage.getItem(`kanban-temp-${city}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTemp;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (age > CACHE_MINUTES * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedTemp(city: string, tempF: number): void {
  try {
    localStorage.setItem(
      `kanban-temp-${city}`,
      JSON.stringify({ tempF, fetchedAt: new Date().toISOString() })
    );
  } catch {
    // ignore
  }
}

export function getCachedLocationTemp(): CachedTemp | null {
  try {
    const raw = localStorage.getItem("kanban-temp-location");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedTemp;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (age > CACHE_MINUTES * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedLocationTemp(tempF: number): void {
  try {
    localStorage.setItem(
      "kanban-temp-location",
      JSON.stringify({ tempF, fetchedAt: new Date().toISOString() })
    );
  } catch {
    // ignore
  }
}
