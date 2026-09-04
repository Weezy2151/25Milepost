/**
 * Pure filtering logic shared by the events page.
 *
 * This lives outside the React tree so the rules that decide which events a
 * visitor sees can be unit-tested directly — they encode a lot of local
 * judgement (what counts as "get outside" in a town called Orchard Park, which
 * events are safe to show under "keep kids busy") and regressions there are
 * silent: the page still renders, it just quietly shows the wrong list.
 */

import type { EventKind as ActivityKind, LiveEvent } from "./events.ts";
import { parseStartMinutes } from "./time.ts";

export type EventKind = "All activities" | ActivityKind;
export type SettingFilter = "all" | "indoor" | "outdoor";
export type Vibe = "all" | "outside" | "kids" | "food" | "evening" | "rain" | "drive";
export type Sort = "recommended" | "closest";

type OptionalLiveFields = "dateKey" | "kind" | "setting" | "priority" | "lat" | "lon" | "distancePrecision";
/** Fallback snapshots predate the normalized live contract, so enrichment fields remain optional only here. */
export type EventPick = Omit<LiveEvent, OptionalLiveFields> & Partial<Pick<LiveEvent, OptionalLiveFields>>;

export const KIND_OPTIONS: EventKind[] = [
  "All activities",
  "Fairs & festivals",
  "Markets & food",
  "Live music",
  "Sports & active",
  "Outdoors",
  "Museums & culture",
  "Community",
  "Library",
];

export const MOODS: { id: Vibe; icon: string; label: string }[] = [
  { id: "outside", icon: "🌳", label: "Get outside" },
  { id: "kids", icon: "🧸", label: "Keep kids busy" },
  { id: "food", icon: "🥐", label: "Eat & browse" },
  { id: "evening", icon: "🌙", label: "After 5" },
  { id: "rain", icon: "🏛️", label: "Rain plan" },
  { id: "drive", icon: "🚗", label: "Worth the drive" },
];

/** Only "Free…" with no dollar figure counts — "12 & under free" still has a ticket price. */
export function isFree(cost: string) {
  return /^\s*free/i.test(cost) && !cost.includes("$");
}

/** Rough drive time from Orchard Park — a mix of village roads and highway, ~32 mph average. */
export function driveMinutes(distance: number) {
  return Math.max(5, Math.round((distance / 32) * 60));
}

export function settingLabel(setting?: EventPick["setting"]) {
  if (setting === "indoor") return "Indoor";
  if (setting === "outdoor") return "Outdoor";
  return "Indoor + outdoor";
}

export function moodLabel(vibe: Vibe) {
  return MOODS.find((mood) => mood.id === vibe)?.label ?? "All";
}

/** "After 5" means exactly that: 5 PM as minutes past midnight. */
const EVENING_MINUTES = 17 * 60;

/**
 * Drop a town's name from a venue or title before looking for landmark words
 * in it. Half the towns in range have a word like "Park" in their name, so
 * without this an indoor listing in Orchard Park reads as parkland.
 */
function withoutTown(value: string, town: string) {
  if (!town) return value;
  const escaped = town.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(escaped, "gi"), " ");
}

/** An event paired with the lowercased blob the search box and vibe rules read. */
export type SearchableEvent = { event: EventPick; text: string };

export function searchText(event: EventPick) {
  return `${event.title} ${event.description} ${event.venue} ${event.town} ${event.tags.join(" ")} ${event.kind || ""}`.toLowerCase();
}

export function buildSearchIndex(events: EventPick[]): SearchableEvent[] {
  return events.map((event) => ({ event, text: searchText(event) }));
}

export function matchesVibe(event: EventPick, choice: Vibe, text: string) {
  if (choice === "all") return true;
  if (choice === "outside") {
    if (event.setting === "outdoor" || event.setting === "both") return true;
    // An indoor event is never a way to get outside, however outdoorsy its
    // wording — a nature slideshow at the library is still at the library.
    if (event.setting === "indoor") return false;
    // Match outdoor-oriented keywords but NOT town names like "Orchard Park".
    // The town has to come out of the venue before looking for a park in it,
    // or every venue in Orchard Park reads as parkland.
    const venue = withoutTown(event.venue, event.town);
    return /\b(trail|hike|hiking|nature|outdoor|lawn|garden|beach|waterfront)\b/i.test(text)
      || /\bparks?\b/i.test(venue) || /\bparks?\b/i.test(withoutTown(event.title, event.town));
  }
  if (choice === "kids") {
    // Exclude age-gated events — 18+/21+ bars, breweries, etc.
    if (/\b(18\+|21\+|adults?\s*only)\b/i.test(text) || event.tags?.includes("21+")) return false;
    return /\b(kids|family|children|storytime|playground|playhouse|play cafe|play area|animals|museum)\b/i.test(text) || event.kind === "Library";
  }
  if (choice === "food") return event.kind === "Markets & food" || /\b(market|produce|farm|food|tasting|bakery|food truck)\b/i.test(text);
  if (choice === "evening") {
    // Read the event's own start time. A naive scan finds the *end* of a range
    // written "4:30–6:30 PM" and calls a late-afternoon event an evening one,
    // so this goes through the shared parser.
    const start = parseStartMinutes(event.time);
    if (start !== null) return start >= EVENING_MINUTES;
    // With no readable clock, fall back to explicitly evening-oriented content.
    return /\b(night|sunset|evening)\b/i.test(event.time)
      || /\b(concert|live music|theater|theatre|bills|bisons)\b/i.test(text);
  }
  if (choice === "rain") {
    // A concert on the library lawn is not somewhere to shelter from the rain.
    if (event.setting === "outdoor") return false;
    return event.setting === "indoor" || /\b(museum|indoor|library|play cafe|escape|theatre)\b/i.test(text);
  }
  if (choice === "drive") return event.distance >= 12;
  return true;
}

/** Everything the results list filters on except which day is selected. */
export type FilterCriteria = {
  kind: EventKind;
  setting: SettingFilter;
  vibe: Vibe;
  maxDistance: number | null;
  sort: Sort;
  query: string;
  showSaved: boolean;
};

export const DEFAULT_CRITERIA: FilterCriteria = {
  kind: "All activities",
  setting: "all",
  vibe: "all",
  maxDistance: null,
  sort: "recommended",
  query: "",
  showSaved: false,
};

/**
 * Apply every filter except the day.
 *
 * Kept day-agnostic on purpose: the same result set both feeds the list and
 * counts how many events each day tab would show, so the two can never
 * disagree.
 */
export function filterEvents(
  searchable: SearchableEvent[],
  criteria: FilterCriteria,
  savedIds: ReadonlySet<string>,
): EventPick[] {
  const needle = criteria.query.trim().toLowerCase();
  const list: EventPick[] = [];
  for (const { event, text } of searchable) {
    if (criteria.kind !== "All activities" && event.kind !== criteria.kind && !(!event.kind && event.tags.includes(criteria.kind))) continue;
    if (criteria.setting !== "all") {
      const eventSetting = event.setting || "both";
      if (eventSetting !== criteria.setting && eventSetting !== "both") continue;
    }
    if (criteria.maxDistance !== null && event.distance > criteria.maxDistance) continue;
    if (!matchesVibe(event, criteria.vibe, text)) continue;
    if (criteria.showSaved && !savedIds.has(event.id)) continue;
    if (needle && !text.includes(needle)) continue;
    list.push(event);
  }
  if (criteria.sort === "closest") return [...list].sort((a, b) => a.distance - b.distance);
  return list;
}

/**
 * Everything about what the visitor is currently looking at: the filters plus
 * which day is selected (null meaning "whichever day the event set calls
 * today").
 *
 * Held as one value so there is a single place to serialize from — the day and
 * filters go into the URL together, and eight independent setters have no such
 * place.
 */
export type ViewState = FilterCriteria & { day: string | null };

export const DEFAULT_VIEW: ViewState = { ...DEFAULT_CRITERIA, day: null };

export type ViewAction =
  | { type: "kind"; value: EventKind }
  | { type: "setting"; value: SettingFilter }
  | { type: "vibe"; value: Vibe }
  | { type: "maxDistance"; value: number | null }
  | { type: "sort"; value: Sort }
  | { type: "query"; value: string }
  | { type: "showSaved"; value: boolean }
  | { type: "day"; value: string | null }
  /** Return one filter to its default — the removable chips above. */
  | { type: "clear"; key: keyof FilterCriteria }
  /** Clear every filter but stay on the selected day. */
  | { type: "clearFilters" }
  /** Clear the filters and go back to today. */
  | { type: "resetAll" };

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "clear":
      return { ...state, [action.key]: DEFAULT_CRITERIA[action.key] };
    case "clearFilters":
      return { ...DEFAULT_VIEW, day: state.day };
    case "resetAll":
      return DEFAULT_VIEW;
    default: {
      // Returning the same object when nothing moved keeps re-selecting the
      // current option from re-running the filter pass.
      if (state[action.type] === action.value) return state;
      return { ...state, [action.type]: action.value };
    }
  }
}

/** The filters a visitor has actually applied, as removable chips. */
export function activeCriteria(criteria: FilterCriteria): { key: keyof FilterCriteria; label: string }[] {
  const list: { key: keyof FilterCriteria; label: string }[] = [];
  if (criteria.vibe !== "all") list.push({ key: "vibe", label: moodLabel(criteria.vibe) });
  if (criteria.kind !== "All activities") list.push({ key: "kind", label: criteria.kind });
  if (criteria.setting !== "all") list.push({ key: "setting", label: criteria.setting === "indoor" ? "Indoor" : "Outdoor" });
  if (criteria.maxDistance !== null) list.push({ key: "maxDistance", label: `Within ${criteria.maxDistance} mi` });
  if (criteria.showSaved) list.push({ key: "showSaved", label: "Saved only" });
  if (criteria.query.trim()) list.push({ key: "query", label: `“${criteria.query.trim()}”` });
  return list;
}
