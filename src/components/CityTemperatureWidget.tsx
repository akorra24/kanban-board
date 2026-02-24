import { useCallback, useEffect, useRef, useState } from "react";
import * as weather from "../lib/weather";
import { getCity, setCity, getUseLocation, setUseLocation } from "../lib/prefs";

export function CityTemperatureWidget() {
  const [city, setCityState] = useState("");
  const [useLocation, setUseLocationState] = useState(false);
  const [temp, setTemp] = useState<number | "loading" | "error">("loading");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const loadCity = useCallback(async () => {
    const ul = getUseLocation();
    setUseLocationState(ul);
    let saved = getCity();
    if (!saved && !ul) {
      const ipCity = await weather.fetchCityFromIP();
      if (ipCity) {
        setCity(ipCity);
        saved = ipCity;
      }
    }
    setCityState(ul ? "Current location" : saved);
    setInputValue(saved);
  }, []);

  const fetchTempByCity = useCallback(async (cityName: string) => {
    if (!cityName.trim()) {
      setTemp("error");
      return;
    }
    const cached = weather.getCachedTemp(cityName);
    if (cached) {
      setTemp(cached.tempF);
      return;
    }
    setTemp("loading");
    const geo = await weather.geocodeCity(cityName);
    if (!geo) {
      setTemp("error");
      return;
    }
    const tempF = await weather.fetchTemperature(geo.latitude, geo.longitude);
    if (tempF == null) {
      setTemp("error");
      return;
    }
    weather.setCachedTemp(cityName, tempF);
    setTemp(tempF);
  }, []);

  const fetchTempByCoords = useCallback(async (lat: number, lon: number) => {
    setTemp("loading");
    const tempF = await weather.fetchTemperature(lat, lon);
    if (tempF != null) {
      weather.setCachedLocationTemp(tempF);
      setTemp(tempF);
    } else {
      setTemp("error");
    }
  }, []);

  useEffect(() => {
    loadCity();
  }, []);

  useEffect(() => {
    if (useLocation) {
      const cached = weather.getCachedLocationTemp();
      if (cached) setTemp(cached.tempF);
      else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (p) => fetchTempByCoords(p.coords.latitude, p.coords.longitude),
          () => setTemp("error")
        );
      } else setTemp("error");
    } else if (city && city !== "Current location") {
      fetchTempByCity(city);
    } else {
      setTemp("loading");
    }
    const t = setInterval(() => {
      if (useLocation && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (p) => fetchTempByCoords(p.coords.latitude, p.coords.longitude),
          () => {}
        );
      } else if (city && city !== "Current location") {
        fetchTempByCity(city);
      }
    }, 45 * 60 * 1000);
    return () => clearInterval(t);
  }, [city, useLocation, fetchTempByCity, fetchTempByCoords]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    if (popoverOpen) document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [popoverOpen]);

  const handleSave = () => {
    const v = inputValue.trim();
    if (v) {
      setCity(v);
      setUseLocation(false);
      setUseLocationState(false);
      setCityState(v);
      fetchTempByCity(v);
    }
    setPopoverOpen(false);
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    setUseLocation(true);
    setUseLocationState(true);
    setCityState("Current location");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchTempByCoords(pos.coords.latitude, pos.coords.longitude);
        setPopoverOpen(false);
      },
      () => setPopoverOpen(false)
    );
  };

  const displayTemp =
    temp === "loading" ? "—°F" : temp === "error" ? "Temp —" : `${temp}°F`;
  const displayCity = city || "Set city";

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setPopoverOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full glass-pill px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-white/20 dark:text-gray-200 dark:hover:bg-white/15"
        title="Click to change city"
      >
        <svg
          className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <span className="truncate max-w-[100px]">{displayCity}</span>
        <span className="tabular-nums">{displayTemp}</span>
      </button>
      {popoverOpen && (
        <div className="glass-strong absolute left-0 top-full z-50 mt-2 w-64 rounded-xl p-3 shadow-xl">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="City name"
            className="mb-2 w-full rounded-lg border border-gray-300 bg-white/80 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-gray-400 focus:outline-none dark:border-white/20 dark:bg-white/10 dark:text-gray-100"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-gray-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white/15 dark:hover:bg-white/25"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleUseLocation}
              className="rounded-full glass-pill px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400"
            >
              Use my location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
