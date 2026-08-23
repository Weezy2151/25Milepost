import { getCachedEntry, setCachedData } from "../../../db/cache";
import { fetchPublicText } from "../../../lib/safe-fetch";
import { weatherSchema, type Weather } from "../../../lib/weather";

const CACHE_KEY = "weather:orchard-park:v1";
const URL = "https://api.open-meteo.com/v1/forecast?latitude=42.767&longitude=-78.744&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=8";

function label(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Misty";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain possible";
  if (code <= 77) return "Wintry";
  if (code >= 95) return "Storms possible";
  return "Changeable skies";
}

function normalize(value: unknown): Weather | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const current = data.current as Record<string, unknown> | undefined;
  const daily = data.daily as Record<string, unknown> | undefined;
  const dates = Array.isArray(daily?.time) ? daily.time : [];
  const codes = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const highs = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
  const lows = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];
  const rains = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : [];
  const currentCode = Number(current?.weather_code);
  const candidate = {
    label: label(currentCode),
    now: Math.round(Number(current?.temperature_2m)),
    high: Math.round(Number(highs[0])),
    rain: Number(rains[0]),
    days: dates.map((dateKey, index) => ({
      dateKey,
      label: label(Number(codes[index])),
      high: Math.round(Number(highs[index])),
      low: Math.round(Number(lows[index])),
      rain: Number(rains[index]),
      code: Number(codes[index]),
    })),
    updatedAt: new Date().toISOString(),
  };
  const parsed = weatherSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function GET() {
  const cached = await getCachedEntry<Weather>(CACHE_KEY);
  const cachedWeather = weatherSchema.safeParse(cached?.data);
  if (cached && cachedWeather.success && !cached.stale) {
    return Response.json(cachedWeather.data, { headers: { "Cache-Control": "public, max-age=300, s-maxage=900", "X-Cache": "HIT" } });
  }
  try {
    const text = await fetchPublicText(URL, {
      timeoutMs: 4_000,
      maxBytes: 256_000,
      allowedHosts: ["api.open-meteo.com"],
      contentTypes: ["application/json"],
    });
    const weather = normalize(JSON.parse(text));
    if (!weather) throw new Error("Weather response failed schema validation");
    await setCachedData(CACHE_KEY, weather, 900, 3600);
    return Response.json(weather, { headers: { "Cache-Control": "public, max-age=300, s-maxage=900", "X-Cache": "MISS" } });
  } catch (error) {
    if (cachedWeather.success) {
      return Response.json(cachedWeather.data, { headers: { "Cache-Control": "private, no-store", "X-Cache": "STALE" } });
    }
    console.error("[weather] refresh failed", error);
    return Response.json({ error: "Weather unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
