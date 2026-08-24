import type { EventsPayload, LiveEvent, SourceHealth } from "./events";
import { isAllowedEventImage } from "./image-hosts.ts";
import type { DayForecast, Weather } from "./weather";

export type StoredPlanItem = { id: string; title: string };

const EVENT_KINDS = new Set([
  "Fairs & festivals",
  "Markets & food",
  "Live music",
  "Sports & active",
  "Outdoors",
  "Museums & culture",
  "Community",
  "Library",
]);
const EVENT_SETTINGS = new Set(["indoor", "outdoor", "both"]);
const AREAS = new Set(["southtowns", "city"]);
const DISTANCE_PRECISIONS = new Set(["venue", "town", "region"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown, max = Number.POSITIVE_INFINITY): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isOptionalString(value: unknown, max = Number.POSITIVE_INFINITY) {
  return value === undefined || (typeof value === "string" && value.length <= max);
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isWebUrl(value: unknown, allowEmpty = false): value is string {
  if (allowEmpty && value === "") return true;
  if (!isNonEmptyString(value, 2_048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isLiveEvent(value: unknown): value is LiveEvent {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id, 240) &&
    isNonEmptyString(value.town, 160) &&
    isNonEmptyString(value.day, 32) &&
    isNonEmptyString(value.date, 96) &&
    isDateKey(value.dateKey) &&
    isNonEmptyString(value.time, 120) &&
    isNonEmptyString(value.title, 300) &&
    isNonEmptyString(value.venue, 300) &&
    isNonEmptyString(value.source, 160) &&
    isNonEmptyString(value.accent, 32) &&
    typeof value.description === "string" && value.description.length <= 1_000 &&
    typeof value.cost === "string" && value.cost.length <= 240 &&
    isWebUrl(value.url, true) &&
    isWebUrl(value.mapUrl) &&
    isFiniteNumber(value.distance) && value.distance >= 0 && value.distance <= 100 &&
    isFiniteNumber(value.priority) && value.priority >= 0 && value.priority <= 100 &&
    isFiniteNumber(value.lat) && value.lat >= -90 && value.lat <= 90 &&
    isFiniteNumber(value.lon) && value.lon >= -180 && value.lon <= 180 &&
    AREAS.has(value.area as string) &&
    EVENT_KINDS.has(value.kind as string) &&
    EVENT_SETTINGS.has(value.setting as string) &&
    DISTANCE_PRECISIONS.has(value.distancePrecision as string) &&
    Array.isArray(value.tags) &&
    value.tags.length <= 20 &&
    value.tags.every((tag) => isNonEmptyString(tag, 100)) &&
    (value.image === undefined || (isNonEmptyString(value.image, 2_048) && isAllowedEventImage(value.image))) &&
    (value.today === undefined || typeof value.today === "boolean");
}

function isSourceHealth(value: unknown): value is SourceHealth {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.name) &&
    typeof value.ok === "boolean" &&
    (value.count === undefined || (Number.isInteger(value.count) && (value.count as number) >= 0)) &&
    (value.durationMs === undefined || (Number.isInteger(value.durationMs) && (value.durationMs as number) >= 0)) &&
    isOptionalString(value.error, 500);
}

/**
 * Validate same-origin API JSON without shipping the server's full Zod runtime.
 * The route performs the strict schema validation; this guard keeps a corrupt
 * cache entry or unexpected response from crashing the interactive page.
 */
export function parseEventsPayload(value: unknown): EventsPayload | null {
  if (!isRecord(value) || !Array.isArray(value.events) || value.events.length > 1_000 || !value.events.every(isLiveEvent)) return null;
  if (!Array.isArray(value.sources) || value.sources.length > 100 || !value.sources.every(isSourceHealth)) return null;
  if (!Number.isInteger(value.count) || value.count !== value.events.length || !isNonEmptyString(value.updatedAt) || Number.isNaN(Date.parse(value.updatedAt))) return null;
  if (!isRecord(value.window) || !isDateKey(value.window.from) || !isDateKey(value.window.to)) return null;
  if (!isRecord(value.mix) || Object.keys(value.mix).length > 50 || !Object.values(value.mix).every((count) => Number.isInteger(count) && (count as number) >= 0)) return null;
  if (!isRecord(value.freshness) ||
      !new Set(["fresh", "stale", "last-good"]).has(value.freshness.state as string) ||
      !isFiniteNumber(value.freshness.ageSeconds) || value.freshness.ageSeconds < 0 ||
      !isDateKey(value.freshness.builtFor) || !isNonEmptyString(value.freshness.store, 100)) return null;
  return value as EventsPayload;
}

function isDayForecast(value: unknown): value is DayForecast {
  if (!isRecord(value)) return false;
  return isDateKey(value.dateKey) &&
    isNonEmptyString(value.label, 100) &&
    isFiniteNumber(value.high) &&
    isFiniteNumber(value.low) &&
    isFiniteNumber(value.rain) && value.rain >= 0 && value.rain <= 100 &&
    Number.isInteger(value.code);
}

export function parseWeatherPayload(value: unknown): Weather | null {
  if (!isRecord(value) || !isNonEmptyString(value.label, 100) || !isNonEmptyString(value.updatedAt) || Number.isNaN(Date.parse(value.updatedAt))) return null;
  if (!isFiniteNumber(value.now) || !isFiniteNumber(value.high) || !isFiniteNumber(value.rain)) return null;
  if (value.rain < 0 || value.rain > 100 || !Array.isArray(value.days) || value.days.length < 1 || value.days.length > 8) return null;
  return value.days.every(isDayForecast) ? value as Weather : null;
}

export function parseStoredIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > 500 || !parsed.every((id) => isNonEmptyString(id, 240))) return [];
    return [...new Set(parsed)];
  } catch {
    return [];
  }
}

function isStoredPlanItem(value: unknown): value is StoredPlanItem {
  return isRecord(value) && isNonEmptyString(value.id, 240) && isNonEmptyString(value.title, 300);
}

/** Read the compact v2 itinerary and migrate the previous full-event array. */
export function parseStoredPlan(value: string | null): StoredPlanItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    const items = isRecord(parsed) && parsed.version === 2 ? parsed.items : parsed;
    if (!Array.isArray(items) || items.length > 100 || !items.every(isStoredPlanItem)) return [];
    return items.map(({ id, title }) => ({ id, title }));
  } catch {
    return [];
  }
}
