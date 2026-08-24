"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { parseEventsPayload, parseStoredIds, parseStoredPlan, parseWeatherPayload, type StoredPlanItem } from "../lib/client-data";
import type { Freshness } from "../lib/events";
import type { DayForecast, Weather } from "../lib/weather";
import {
  fallbackEvents,
  SNAPSHOT_DATE,
  type EventKind,
  type EventPick,
  type SettingFilter,
  type Sort,
  type Vibe,
} from "./events-data";
import { FilterMenu } from "./components/filter-menu";
import { IconBookmark, IconCheck, IconChevron, IconClock, IconCopy, IconExternal, IconMoon, IconPin, IconPlus, IconRoute, IconSearch, IconShare, IconSparkle, IconSun, IconTicket, IconX } from "./components/icons";
import { useModal } from "./components/use-modal";

/* ---------------------------------------------------------------- helpers */

const KIND_OPTIONS: EventKind[] = [
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

const MOODS: { id: Vibe; icon: string; label: string }[] = [
  { id: "outside", icon: "🌳", label: "Get outside" },
  { id: "kids", icon: "🧸", label: "Keep kids busy" },
  { id: "food", icon: "🥐", label: "Eat & browse" },
  { id: "evening", icon: "🌙", label: "After 5" },
  { id: "rain", icon: "🏛️", label: "Rain plan" },
  { id: "drive", icon: "🚗", label: "Worth the drive" },
];

const SAVED_KEY = "twenty-five-mile-post-clippings";
const PLAN_KEY = "twenty-five-mile-post-myday";
const THEME_KEY = "twenty-five-mile-post-theme";

/** Only "Free…" with no dollar figure counts — "12 & under free" still has a ticket price. */
function isFree(cost: string) {
  return /^\s*free/i.test(cost) && !cost.includes("$");
}

/** Rough drive time from Orchard Park — a mix of village roads and highway, ~32 mph average. */
function driveMinutes(distance: number) {
  return Math.max(5, Math.round((distance / 32) * 60));
}

function settingLabel(setting?: EventPick["setting"]) {
  if (setting === "indoor") return "Indoor";
  if (setting === "outdoor") return "Outdoor";
  return "Indoor + outdoor";
}

function moodLabel(vibe: Vibe) {
  return MOODS.find((mood) => mood.id === vibe)?.label ?? "All";
}

/* ------------------------------------------------------------- event card */

const EventCard = memo(function EventCard({
  event,
  isSaved,
  inPlan,
  forecast,
  onToggleSave,
  onTogglePlan,
  onOpen,
}: {
  event: EventPick;
  isSaved: boolean;
  inPlan: boolean;
  forecast: DayForecast | null;
  onToggleSave: (id: string) => void;
  onTogglePlan: (event: EventPick) => void;
  onOpen: (event: EventPick) => void;
}) {
  const initials = event.town === "Orchard Park" ? "OP" : event.town.slice(0, 2).toUpperCase();
  // Aggregated feeds occasionally repeat a tag; de-dupe so React keys stay unique.
  const tags = [...new Set(event.tags)].slice(0, 3);

  return (
    <article className={`card accent-${event.accent}`} id={event.id}>
      <button type="button" className="card-media" onClick={() => onOpen(event)} aria-label={`Open details for ${event.title}`}>
        {event.image ? (
          <Image
            src={event.image}
            alt=""
            fill
            quality={70}
            sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 891px) calc((100vw - 72px) / 2), (max-width: 1175px) calc((100vw - 88px) / 3), 294px"
          />
        ) : (
          <span className="card-pattern">
            <em>{event.tags[0]}</em>
            <b>{initials}</b>
          </span>
        )}
        <span className="card-flags">
          <span className={event.today ? "flag today" : "flag"}>{event.day}</span>
          <span className="flag" title={event.distancePrecision === "town" ? `Approximate — measured from the centre of ${event.town}` : undefined}>
            {event.distancePrecision === "town" || event.distancePrecision === "region" ? "~" : ""}
            {event.distance} mi · ~{driveMinutes(event.distance)} min
          </span>
        </span>
      </button>

      <div className="card-body">
        <p className="card-when">
          <IconClock />
          {event.date} <span>·</span> {event.time}
        </p>
        <h3>
          <button type="button" className="card-title" onClick={() => onOpen(event)}>
            {event.title}
          </button>
        </h3>
        <p className="card-where">
          <IconPin />
          <span>
            {event.venue} · {event.town}
          </span>
        </p>
        <p className="card-desc">{event.description}</p>
        <div className="card-tags">
          {forecast && (
            <span className={forecast.rain >= 40 ? "tag weather wet" : "tag weather"} title={`${forecast.label} on the day of this event`}>
              <i aria-hidden="true">{weatherEmoji(forecast.code)}</i> {forecast.high}° · {forecast.rain}% rain
            </span>
          )}
          <span className="tag setting">{settingLabel(event.setting)}</span>
          {tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="card-foot">
        <div className="card-cost">
          <b className={isFree(event.cost) ? "free" : ""} title={event.cost}>
            {event.cost}
          </b>
          <small>via {event.source}</small>
        </div>
        <div className="card-acts">
          <button
            type="button"
            className={inPlan ? "icon-btn on" : "icon-btn"}
            onClick={() => onTogglePlan(event)}
            aria-pressed={inPlan}
            aria-label={inPlan ? `Remove ${event.title} from My Day` : `Add ${event.title} to My Day`}
            title={inPlan ? "Remove from My Day" : "Add to My Day"}
          >
            {inPlan ? <IconCheck /> : <IconPlus />}
          </button>
          <button
            type="button"
            className={isSaved ? "icon-btn on" : "icon-btn"}
            onClick={() => onToggleSave(event.id)}
            aria-pressed={isSaved}
            aria-label={isSaved ? `Remove ${event.title} from saved events` : `Save ${event.title} for later`}
            title={isSaved ? "Remove from saved" : "Save for later"}
          >
            <IconBookmark />
          </button>
          <a className="icon-btn" href={event.mapUrl} target="_blank" rel="noreferrer" aria-label={`Directions to ${event.venue}`} title={`Directions to ${event.venue}`}>
            <IconPin />
          </a>
        </div>
      </div>
    </article>
  );
});

/* -------------------------------------------------------------- home page */

function weatherEmoji(code: number) {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67 || (code >= 80 && code <= 82)) return "🌧️";
  if (code <= 77) return "❄️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

/**
 * Calendars the API actually pulls on each refresh — keep in step with
 * LIBRARY_FEEDS / TRIBE_FEEDS / ICS_FEEDS in app/api/events/route.ts.
 */
const FETCHED_SOURCES: Array<[string, string]> = [
  ["Buffalo & Erie County Public Library", "https://www.buffalolib.org/"],
  ["EverythingOP", "https://everythingop.com/events/"],
  ["Orchard Park Chamber", "https://orchardparkchamber.org/events/"],
  ["Buffalo Rising", "https://www.buffalorising.com/events/"],
  ["Town of Orchard Park", "https://www.orchardparkny.gov/events/"],
  ["Town of Evans", "https://townofevansny.gov/events/"],
  ["Southtowns Regional Chamber", "https://southtownsregionalchamber.org/news-events/"],
  ["Explore & More", "https://exploreandmore.org/events/"],
  ["Erie County Parks", "https://www3.erie.gov/parks/events"],
  ["Step Out Buffalo", "https://stepoutbuffalo.com/all-events/"],
  ["East Aurora Chamber", "https://business.eanycc.com/eventcalendar"],
];

/**
 * Publishers with no usable feed. These are read by a person and turned into
 * the curated entries in the API route, so they are listed separately rather
 * than implying the app scrapes them.
 */
const MANUAL_SOURCES: Array<[string, string]> = [
  ["Visit Buffalo Niagara", "https://visitbuffalo.com/events/"],
  ["Village of Hamburg", "https://villageofhamburgny.gov/events"],
  ["Village of East Aurora", "https://www.eastaurora.gov/news-updates-events/calendar-of-events"],
  ["WNY Family Magazine", "https://www.wnyfamilymagazine.com/search/event/calendar-of-events/index.html"],
  ["Orchard Park Bee", "https://www.orchardparkbee.com/"],
  ["Hamburg Sun", "https://www.sun-news.com/"],
];

function persist(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — state still works for this session */
  }
}

export default function Home() {
  const [events, setEvents] = useState<EventPick[]>(fallbackEvents);
  const [loading, setLoading] = useState(true);
  /** "snapshot" until live calendars answer, so the UI can say which it is showing. */
  const [feed, setFeed] = useState<{ state: "snapshot" | "live"; ok: number; total: number }>({
    state: "snapshot",
    ok: 0,
    total: 0,
  });
  /** How current the API said its payload was — see `freshness` in the route. */
  const [freshness, setFreshness] = useState<Freshness | null>(null);

  const [kind, setKind] = useState<EventKind>("All activities");
  const [setting, setSetting] = useState<SettingFilter>("all");
  const [vibe, setVibe] = useState<Vibe>("all");
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  /** null = "today" (whichever day the current event set flags as today). */
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recommended");
  const [query, setQuery] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const [saved, setSaved] = useState<string[]>([]);
  const [planItems, setPlanItems] = useState<StoredPlanItem[]>([]);
  const [selected, setSelected] = useState<EventPick | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [greeting, setGreeting] = useState("Hello, Orchard Park.");
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");
  const [notice, setNotice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const savedRef = useRef<string[]>([]);
  const planItemsRef = useRef<StoredPlanItem[]>([]);
  const deferredQuery = useDeferredValue(query);
  const savedSet = useMemo(() => new Set(saved), [saved]);
  const planIds = useMemo(() => new Set(planItems.map((item) => item.id)), [planItems]);
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const plan = useMemo(() => planItems.flatMap((item) => eventById.get(item.id) ?? []), [planItems, eventById]);
  const unavailablePlan = useMemo(() => planItems.filter((item) => !eventById.has(item.id)), [planItems, eventById]);
  const planCount = planItems.length;

  /* ---- boot: local state, greeting, feeds ---- */

  useEffect(() => {
    // Storage is read after mount (not in a state initialiser) so the server and
    // client render the same first pass; the extra render is the point, not a bug.
    /* eslint-disable react-hooks/set-state-in-effect */
    let resolvedTheme: "light" | "dark" = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    try {
      const storedSaved = parseStoredIds(window.localStorage.getItem(SAVED_KEY));
      const storedPlan = parseStoredPlan(window.localStorage.getItem(PLAN_KEY));
      savedRef.current = storedSaved;
      planItemsRef.current = storedPlan;
      setSaved(storedSaved);
      setPlanItems(storedPlan);
      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (storedTheme === "dark" || storedTheme === "light") resolvedTheme = storedTheme;
    } catch {
      /* storage unavailable — carry on with defaults */
    }
    setTheme(resolvedTheme);

    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning, Orchard Park." : hour < 17 ? "Good afternoon, Orchard Park." : "Good evening, Orchard Park.");
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch("/api/events", { signal: controller.signal });
        if (!response.ok) throw new Error("refresh failed");
        const data = parseEventsPayload(await response.json());
        if (data?.events.length) {
          setEvents(data.events);
          setUpdatedAt(data.updatedAt);
          const sources = data.sources;
          setFeed({
            state: "live",
            ok: sources.filter((source) => source.ok).length,
            total: sources.length,
          });
          setFreshness(data.freshness ?? null);
        }
      } catch {
        // Leave feed.state as "snapshot"; the banner explains what is on screen.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    fetch("/api/weather", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("weather refresh failed");
        return response.json();
      })
      .then((value) => {
        setWeather(parseWeatherPayload(value));
      })
      .catch(() => { if (!controller.signal.aborted) setWeather(null); })
      .finally(() => { if (!controller.signal.aborted) setWeatherLoading(false); });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ---- filtering ---- */

  const searchableEvents = useMemo(() => events.map((event) => ({
    event,
    text: `${event.title} ${event.description} ${event.venue} ${event.town} ${event.tags.join(" ")} ${event.kind || ""}`.toLowerCase(),
  })), [events]);

  const matchesVibe = useCallback((event: EventPick, choice: Vibe, text: string) => {
    if (choice === "all") return true;
    if (choice === "outside") return event.setting === "outdoor" || event.setting === "both" || /park|trail|hike|nature|outdoor|lawn/i.test(text);
    if (choice === "kids") return /kids|family|children|storytime|play|animals|museum/i.test(text) || event.kind === "Library";
    if (choice === "food") return event.kind === "Markets & food" || /market|produce|farm|food|tasting|bakery/i.test(text);
    if (choice === "evening") return /pm|night|sunset|concert|game|after/i.test(event.time) || /concert|music|theater|bills|bisons/i.test(text);
    if (choice === "rain") return event.setting === "indoor" || /museum|indoor|library|play cafe|escape|theatre/i.test(text);
    if (choice === "drive") return event.distance >= 12;
    return true;
  }, []);

  // Every filter except which day is selected — used both for the results list
  // and to count how many events each day tab would show.
  const baseFiltered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const list: EventPick[] = [];
    for (const { event, text } of searchableEvents) {
      if (kind !== "All activities" && event.kind !== kind && !(!event.kind && event.tags.includes(kind))) continue;
      if (setting !== "all" && event.setting !== setting && event.setting !== "both" && event.setting) continue;
      if (maxDistance !== null && event.distance > maxDistance) continue;
      if (!matchesVibe(event, vibe, text)) continue;
      if (showSaved && !savedSet.has(event.id)) continue;
      if (needle && !text.includes(needle)) continue;
      list.push(event);
    }
    if (sort === "closest") return [...list].sort((a, b) => a.distance - b.distance);
    return list;
  }, [searchableEvents, kind, setting, maxDistance, vibe, showSaved, savedSet, deferredQuery, sort, matchesVibe]);

  /** The week's days in order, one tile per distinct date the current event set covers. */
  const days = useMemo(() => {
    const seen = new Map<string, { dateKey: string; day: string; date: string }>();
    for (const event of events) {
      if (event.dateKey && !seen.has(event.dateKey)) seen.set(event.dateKey, { dateKey: event.dateKey, day: event.day, date: event.date });
    }
    return [...seen.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey)).slice(0, 8);
  }, [events]);

  /** Forecast keyed by date, so each day tile can carry its own sky. */
  const dayWeather = useMemo(() => new Map((weather?.days ?? []).map((day) => [day.dateKey, day])), [weather]);

  const todayKey = useMemo(() => events.find((event) => event.today)?.dateKey ?? days[0]?.dateKey ?? "", [events, days]);
  const activeDay = selectedDay ?? todayKey;

  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of baseFiltered) {
      if (!event.dateKey) continue;
      counts.set(event.dateKey, (counts.get(event.dateKey) ?? 0) + 1);
    }
    return counts;
  }, [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter((event) => event.dateKey === activeDay), [baseFiltered, activeDay]);

  const spotlight = useMemo(() => events.filter((event) => (event.priority ?? 0) >= 8).slice(0, 3), [events]);

  /* ---- derived UI state ---- */

  const activeFilters = useMemo(() => {
    const list: { key: string; label: string; clear: () => void }[] = [];
    if (vibe !== "all") list.push({ key: "vibe", label: moodLabel(vibe), clear: () => setVibe("all") });
    if (kind !== "All activities") list.push({ key: "kind", label: kind, clear: () => setKind("All activities") });
    if (setting !== "all") list.push({ key: "setting", label: setting === "indoor" ? "Indoor" : "Outdoor", clear: () => setSetting("all") });
    if (maxDistance !== null) list.push({ key: "distance", label: `Within ${maxDistance} mi`, clear: () => setMaxDistance(null) });
    if (showSaved) list.push({ key: "saved", label: "Saved only", clear: () => setShowSaved(false) });
    if (query.trim()) list.push({ key: "query", label: `“${query.trim()}”`, clear: () => setQuery("") });
    return list;
  }, [vibe, kind, setting, maxDistance, showSaved, query]);

  const clearAll = () => {
    setVibe("all");
    setKind("All activities");
    setSetting("all");
    setMaxDistance(null);
    setShowSaved(false);
    setQuery("");
  };

  const showSpotlight = spotlight.length > 0 && activeFilters.length === 0 && activeDay === todayKey;
  const activeDayMeta = days.find((day) => day.dateKey === activeDay);
  const todayEvents = useMemo(() => baseFiltered.filter((event) => event.dateKey === todayKey), [baseFiltered, todayKey]);
  const todayCount = todayEvents.length;
  const freeToday = todayEvents.filter((event) => isFree(event.cost)).length;
  const closeToday = todayEvents.filter((event) => event.distance <= 5).length;

  /**
   * The forecast for the day on screen.
   *
   * The advisory used to key off today's rain no matter which day you were
   * browsing, so a wet Wednesday told you to plan indoors for a sunny
   * Saturday. Everything weather-facing below reads this instead.
   */
  const dayForecast = useMemo(
    () => dayWeather.get(activeDay) ?? null,
    [dayWeather, activeDay],
  );
  const viewingToday = activeDay === todayKey;
  const rainLikely = dayForecast !== null && dayForecast.rain >= 40;

  /* ---- actions ---- */

  const toggleSave = useCallback((id: string) => {
    const current = savedRef.current;
    const exists = current.includes(id);
    const next = exists ? current.filter((item) => item !== id) : [...current, id];
    savedRef.current = next;
    setSaved(next);
    persist(SAVED_KEY, next);
    setNotice(exists ? "Removed from saved." : "Saved to this device.");
  }, []);

  const togglePlan = useCallback((event: EventPick) => {
    const current = planItemsRef.current;
    const exists = current.some((item) => item.id === event.id);
    const next = exists ? current.filter((item) => item.id !== event.id) : [...current, { id: event.id, title: event.title }];
    planItemsRef.current = next;
    setPlanItems(next);
    persist(PLAN_KEY, { version: 2, items: next });
    setNotice(exists ? `Removed “${event.title}” from My Day.` : `Added “${event.title}” to My Day.`);
  }, []);

  const removePlanItem = (id: string, title: string) => {
    const next = planItems.filter((item) => item.id !== id);
    planItemsRef.current = next;
    setPlanItems(next);
    persist(PLAN_KEY, { version: 2, items: next });
    setNotice(`Removed “${title}” from My Day.`);
  };

  const clearPlan = () => {
    planItemsRef.current = [];
    setPlanItems([]);
    persist(PLAN_KEY, { version: 2, items: [] });
    setNotice("My Day cleared.");
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "The 25-Mile Post",
          text: "Family things to do around Orchard Park and the Southtowns",
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setNotice("Link copied.");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const copyItinerary = async () => {
    const text = planItems.map((item, index) => {
      const stop = eventById.get(item.id);
      return stop ? `${index + 1}. ${stop.title} (${stop.time}) — ${stop.venue}, ${stop.town}` : `${index + 1}. ${item.title} — no longer in current listings`;
    }).join("\n");
    try {
      await navigator.clipboard.writeText(`My Day · The 25-Mile Post\n\n${text}`);
      setNotice("Itinerary copied to clipboard.");
    } catch {
      setNotice("Could not copy — try selecting the text instead.");
    }
  };

  const focusSearch = () => {
    searchRef.current?.scrollIntoView({ block: "center" });
    searchRef.current?.focus();
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable — theme still works for this session */
    }
  };

  const closeDetails = useCallback(() => setSelected(null), []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const detailRef = useModal(selected !== null, closeDetails);
  const planRef = useModal(planOpen, closePlan);
  const sheetRef = useModal(sheetOpen, closeSheet);

  /* --------------------------------------------------------------- render */

  return (
    <>
      <a className="skip-link" href="#results">
        Skip to events
      </a>

      {/* Filtering is instant and silent for sighted users; announce it for the rest. */}
      <p className="sr-only" role="status" aria-live="polite">
        {`${filtered.length} ${filtered.length === 1 ? "event" : "events"} match your filters for the selected day, ${todayCount} today.`}
      </p>

      <header className="topbar" data-modal-background>
        <div className="wrap topbar-inner">
          <a className="wordmark" href="#top">
            <span className="wordmark-mark">25</span>
            <span className="wordmark-text">
              <b>The 25-Mile Post</b>
              <span>Orchard Park · Southtowns</span>
            </span>
          </a>

          {weather && (
            <span className="topbar-weather">
              <span className="live-dot" />
              {weather.label} · <b>{weather.now}°</b> · {weather.rain}% rain
            </span>
          )}

          <span className="topbar-spacer" />

          <div className="topbar-actions">
            <button type="button" className="icon-btn topbar-search" onClick={focusSearch} aria-label="Search events" title="Search events">
              <IconSearch />
            </button>
            <button
              type="button"
              className={theme === "dark" ? "icon-btn on" : "icon-btn"}
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            <button type="button" className="icon-btn" onClick={share} aria-label="Share this guide" title="Share this guide">
              <IconShare />
            </button>
            <button
              type="button"
              className={planCount ? "icon-btn on topbar-myday" : "icon-btn topbar-myday"}
              onClick={() => setPlanOpen(true)}
            >
              <IconRoute />
              My Day
              {planCount > 0 && <span className="pill-count">{planCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main id="top" data-modal-background>
        {/* ------------------------------------------------------------ hero */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">Today around Orchard Park · 25-mile radius</p>
              <h1 className="display hero-title">{greeting}</h1>
              <p className="hero-sub">
                Your local day, figured out. <b>{events.length} events</b> pulled from town calendars, libraries and community desks —
                refreshed each morning.
              </p>

              <label className="search">
                <IconSearch />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search farmers markets, live music, storytime…"
                  aria-label="Search events"
                />
                {query && (
                  <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                    <IconX />
                  </button>
                )}
              </label>

              <div className="moods" role="group" aria-label="Filter by mood">
                {MOODS.map((mood) => (
                  <button
                    key={mood.id}
                    type="button"
                    className="mood"
                    aria-pressed={vibe === mood.id}
                    onClick={() => setVibe(vibe === mood.id ? "all" : mood.id)}
                  >
                    <i aria-hidden="true">{mood.icon}</i>
                    {mood.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="aside-stack">
              <div className="wcard" aria-busy={weatherLoading}>
                <div className="wcard-head">
                  <span className={weatherLoading ? "live-dot busy" : "live-dot"} />
                  Live Orchard Park weather
                </div>
                {weather ? (
                  <>
                    <div className="wcard-temp">
                      <b>{weather.now}°</b>
                      <span>{weather.label}</span>
                    </div>
                    <div className="wcard-rows">
                      {/* The temperature above is live; these two follow whichever
                          day the picker is on, so they match the list below. */}
                      <div className="wcard-row">
                        <span>{viewingToday ? "Today’s high" : `High ${activeDayMeta?.day === "TOMORROW" ? "tomorrow" : (activeDayMeta?.date ?? "")}`}</span>
                        <b>{dayForecast ? `${dayForecast.high}°` : "—"}</b>
                      </div>
                      <div className="wcard-row">
                        <span>Chance of rain</span>
                        <b className={rainLikely ? "warn-text" : undefined}>{dayForecast ? `${dayForecast.rain}%` : "—"}</b>
                      </div>
                      <div className="wcard-row">
                        <span>Calendars checked</span>
                        <b className={feed.state === "live" && feed.ok < feed.total ? "warn-text" : undefined}>
                          {feed.state === "live" ? `${feed.ok} of ${feed.total}` : loading ? "Checking…" : "Unreachable"}
                        </b>
                      </div>
                      <div className="wcard-row">
                        <span>Events updated</span>
                        <b>
                          {updatedAt
                            ? `${new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${
                                freshness?.state === "stale" ? " · refreshing" : ""
                              }`
                            : loading
                              ? "Loading…"
                              : "Snapshot"}
                        </b>
                      </div>
                    </div>
                  </>
                ) : weatherLoading ? (
                  <div className="weather-skeleton" aria-hidden="true">
                    <span />
                    <b />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                ) : (
                  <div className="wcard-temp">
                    <span>Forecast unavailable — check before outdoor plans.</span>
                  </div>
                )}
              </div>

              <div className="glance">
                <div className="glance-cell">
                  <b>{todayCount}</b>
                  <span>Today</span>
                </div>
                <div className="glance-cell">
                  <b>{freeToday}</b>
                  <span>Free</span>
                </div>
                <div className="glance-cell">
                  <b>{closeToday}</b>
                  <span>Under 5 mi</span>
                </div>
              </div>
            </div>
          </div>

          {!loading && feed.state === "snapshot" && (
            <div className="wrap">
              <div className="advisory warn" role="status">
                <p>
                  ⚠️ <strong>Live calendars are unreachable right now.</strong> You are seeing a saved snapshot from{" "}
                  {new Date(`${SNAPSHOT_DATE}T12:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })},
                  so dates and times below may have passed.
                </p>
                <button type="button" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </div>
            </div>
          )}

          {freshness?.state === "last-good" && (
            <div className="wrap">
              <div className="advisory warn" role="status">
                <p>
                  ⚠️ <strong>Every calendar failed to answer this morning.</strong> These are the last listings that came
                  through, collected{" "}
                  {new Date(`${freshness.builtFor}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                  , so check times before you go.
                </p>
                <button type="button" onClick={() => window.location.reload()}>
                  Try again
                </button>
              </div>
            </div>
          )}

          {feed.state === "live" && feed.ok < feed.total && (
            <div className="wrap">
              <div className="advisory warn" role="status">
                <p>
                  ⚠️ <strong>
                    {feed.total - feed.ok} of {feed.total} calendars didn&rsquo;t respond.
                  </strong>{" "}
                  Everything below is current, but a few towns may be missing events today.
                </p>
              </div>
            </div>
          )}

          {rainLikely && (
            <div className="wrap">
              <div className="advisory">
                <p>
                  🌧️{" "}
                  <strong>
                    {dayForecast!.rain}% chance of rain{" "}
                    {viewingToday ? "today" : `on ${activeDayMeta?.date ?? "that day"}`}.
                  </strong>{" "}
                  Good {viewingToday ? "day" : "one"} for libraries, museums, play cafés and indoor games.
                </p>
                <button
                  type="button"
                  className={setting === "indoor" ? "on" : ""}
                  onClick={() => setSetting(setting === "indoor" ? "all" : "indoor")}
                >
                  {setting === "indoor" ? "Showing indoor only" : "Show indoor picks"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- day picker */}
        <section className="wrap daypicker-wrap" aria-label="Choose a day">
          <p className="daypicker-label">Pick a day this week</p>
          <div className="daypicker" role="group" aria-label="Day of the week">
            {days.map((day) => (
              <button
                key={day.dateKey}
                type="button"
                className="daypicker-btn"
                aria-pressed={day.dateKey === activeDay}
                onClick={() => setSelectedDay(day.dateKey)}
              >
                <b>{day.day === "TODAY" || day.day === "TOMORROW" ? day.day : day.day.slice(0, 3)}</b>
                <span>{day.date.replace(/^[A-Za-z]+,\s*/, "")}</span>
                {/* Picking a day is a weather decision as much as a calendar one. */}
                {dayWeather.get(day.dateKey) && (
                  <span className="daypicker-sky">
                    <i aria-hidden="true">{weatherEmoji(dayWeather.get(day.dateKey)!.code)}</i>{" "}
                    {dayWeather.get(day.dateKey)!.high}°
                    <span className="sr-only">
                      , {dayWeather.get(day.dateKey)!.label}, {dayWeather.get(day.dateKey)!.rain}% chance of rain
                    </span>
                  </span>
                )}
                <em>{dayCounts.get(day.dateKey) ?? 0}</em>
              </button>
            ))}
          </div>
        </section>

        {/* ----------------------------------------------------- filter bar */}
        <div className="filterbar">
          <div className="wrap filterbar-inner">
            <button
              type="button"
              className={activeFilters.length ? "fmenu-btn on filters-mobile" : "fmenu-btn filters-mobile"}
              onClick={() => setSheetOpen(true)}
            >
              Filters
              {activeFilters.length > 0 && <span className="pill-count">{activeFilters.length}</span>}
              <IconChevron />
            </button>

            <div className="filters-desktop">
            <FilterMenu
              label="Drive time"
              defaultValue="any"
              selected={maxDistance === null ? "any" : String(maxDistance)}
              options={[
                { value: "any", label: `Up to 25 mi · ~${driveMinutes(25)} min` },
                { value: "5", label: `Up to 5 mi · ~${driveMinutes(5)} min` },
                { value: "10", label: `Up to 10 mi · ~${driveMinutes(10)} min` },
                { value: "15", label: `Up to 15 mi · ~${driveMinutes(15)} min` },
              ]}
              onSelect={(value) => setMaxDistance(value === "any" ? null : Number(value))}
            />
            <FilterMenu
              label="Activity"
              defaultValue="All activities"
              selected={kind}
              options={KIND_OPTIONS.map((option) => ({ value: option, label: option }))}
              onSelect={(value) => setKind(value as EventKind)}
            />
            <FilterMenu
              label="Setting"
              defaultValue="all"
              selected={setting}
              options={[
                { value: "all", label: "Indoor + outdoor" },
                { value: "indoor", label: "Indoor" },
                { value: "outdoor", label: "Outdoor" },
              ]}
              onSelect={(value) => setSetting(value as SettingFilter)}
            />
            </div>

            <span className="filter-spacer" />

            <button
              type="button"
              className={showSaved ? "fmenu-btn on" : "fmenu-btn"}
              aria-pressed={showSaved}
              onClick={() => setShowSaved(!showSaved)}
            >
              <IconBookmark />
              Saved
              <b>{saved.length}</b>
            </button>
            <div className="filters-desktop">
              <FilterMenu
                label="Sort"
                align="right"
                defaultValue="recommended"
                selected={sort}
                options={[
                  { value: "recommended", label: "Recommended" },
                  { value: "closest", label: "Closest first" },
                ]}
                onSelect={(value) => setSort(value as Sort)}
              />
            </div>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="wrap">
            <div className="actives">
              <span className="actives-label">
                {filtered.length} {filtered.length === 1 ? "match" : "matches"}
              </span>
              {activeFilters.map((filter) => (
                <button key={filter.key} type="button" className="chip-x" onClick={filter.clear}>
                  {filter.label}
                  <IconX />
                </button>
              ))}
              <button type="button" className="chip-clear" onClick={clearAll}>
                Clear all
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------ spotlight */}
        {showSpotlight && (
          <section className="wrap section" aria-label="Best bets near you">
            <div className="section-head">
              <div>
                <p className="eyebrow">Handpicked highlights</p>
                <h2 className="display">Best bets near you</h2>
              </div>
              <p className="count">The three we&rsquo;d pick first this week</p>
            </div>
            <div className="spot-grid">
              {spotlight.map((event, index) => (
                <button key={event.id} type="button" className="spot" onClick={() => setSelected(event)}>
                  <span className="spot-rank">
                    <IconSparkle style={{ width: 13, height: 13 }} />
                    {index === 0 ? "Featured pick" : index === 1 ? "Family favorite" : "Local highlight"}
                  </span>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <span className="spot-foot">
                    <span>
                      {event.town} · {event.distance} mi
                    </span>
                    <span className={isFree(event.cost) ? "free" : ""} style={isFree(event.cost) ? { color: "var(--good)" } : undefined}>
                      {event.cost.length > 26 ? `${event.cost.slice(0, 26)}…` : event.cost}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* -------------------------------------------------------- results */}
        <section className="wrap section" id="results" tabIndex={-1} aria-label={`Events on ${activeDayMeta?.date ?? "the selected day"}`}>
          <div className="section-head">
            <div>
              <p className="eyebrow">{activeDay === todayKey ? "Today" : "Plan ahead"}</p>
              <h2 className="display">
                {activeDayMeta ? (activeDayMeta.day === "TODAY" || activeDayMeta.day === "TOMORROW" ? activeDayMeta.day[0] + activeDayMeta.day.slice(1).toLowerCase() : activeDayMeta.date) : "This week"}
              </h2>
            </div>
            <p className="count">
              {filtered.length} {filtered.length === 1 ? "event" : "events"}
            </p>
          </div>

          {filtered.length ? (
            <div className="grid">
              {filtered.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isSaved={savedSet.has(event.id)}
                  inPlan={planIds.has(event.id)}
                  forecast={event.dateKey && event.setting !== "indoor" ? dayWeather.get(event.dateKey) ?? null : null}
                  onToggleSave={toggleSave}
                  onTogglePlan={togglePlan}
                  onOpen={setSelected}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>Nothing that day matches those filters</h3>
              <p>Try another day above, widen the drive-time radius, or clear what&rsquo;s applied.</p>
              {(activeFilters.length > 0 || selectedDay !== null) && (
                <button
                  type="button"
                  className="btn-solid"
                  onClick={() => {
                    clearAll();
                    setSelectedDay(null);
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------- sources */}
        <div className="wrap">
          <details className="sources">
            <summary>
              <IconChevron />
              Where we look · {FETCHED_SOURCES.length} live feeds
              <span className="rule" />
            </summary>
            <div className="source-grid">
              <div className="source-col">
                <h3>Fetched every morning</h3>
                {FETCHED_SOURCES.map(([label, href]) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer">
                    {label}
                    <IconExternal />
                  </a>
                ))}
              </div>
              <div className="source-col">
                <h3>Checked by hand</h3>
                {MANUAL_SOURCES.map(([label, href]) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer">
                    {label}
                    <IconExternal />
                  </a>
                ))}
              </div>
            </div>
          </details>
        </div>
      </main>

      <footer className="footer" data-modal-background>
        <div className="wrap footer-inner">
          <div>
            <b>The 25-Mile Post</b>
            <p>
              A handpicked morning guide to family events happening today and this week within about 25 miles of Orchard Park, New York.
            </p>
          </div>
          <div>
            <p>
              Event calendars refresh once each morning. Orchard Park weather is fetched live when you open the page. Distances are
              approximate driving miles from central Orchard Park.
            </p>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------------ detail drawer */}
      {selected && (
        <div className="scrim">
          <button type="button" className="scrim-hit" onClick={closeDetails} aria-label="Close details" />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={selected.title} ref={detailRef} tabIndex={-1}>
            <div className="drawer-top">
              <strong>{selected.day} · {selected.date}</strong>
              <button type="button" className="icon-btn" onClick={closeDetails} aria-label="Close details">
                <IconX />
              </button>
            </div>

            <div className="drawer-scroll">
              {selected.image && (
                <div className="drawer-hero">
                  <Image src={selected.image} alt="" fill quality={70} sizes="(max-width: 760px) 100vw, 440px" />
                </div>
              )}
              <div className="drawer-body">
                <div>
                  <h2>{selected.title}</h2>
                  <p className="drawer-venue" style={{ marginTop: 10 }}>
                    <IconPin />
                    <span>
                      {selected.venue} · {selected.town} — {selected.distance} miles from Orchard Park
                    </span>
                  </p>
                </div>

                <div className="facts">
                  <div className="fact">
                    <span>When</span>
                    <b>{selected.time}</b>
                  </div>
                  <div className="fact">
                    <span>Cost</span>
                    <b style={isFree(selected.cost) ? { color: "var(--good)" } : undefined}>{selected.cost}</b>
                  </div>
                  <div className="fact">
                    <span>Setting</span>
                    <b>{settingLabel(selected.setting)}</b>
                  </div>
                  <div className="fact">
                    <span>Category</span>
                    <b>{selected.kind || "Community"}</b>
                  </div>
                </div>

                <div className="prose">
                  <h4>About this event</h4>
                  <p>{selected.description}</p>
                </div>

                <div className="card-tags">
                  {[...new Set(selected.tags)].map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a className="btn-ghost" href={selected.url} target="_blank" rel="noreferrer">
                    <IconTicket style={{ width: 15, height: 15 }} />
                    {selected.source}
                    <IconExternal style={{ width: 13, height: 13 }} />
                  </a>
                  <button
                    type="button"
                    className={saved.includes(selected.id) ? "btn-ghost" : "btn-ghost"}
                    onClick={() => toggleSave(selected.id)}
                  >
                    <IconBookmark style={{ width: 15, height: 15 }} />
                    {saved.includes(selected.id) ? "Saved" : "Save for later"}
                  </button>
                </div>
              </div>
            </div>

            <div className="drawer-foot">
              <button type="button" className="btn-solid" onClick={() => togglePlan(selected)}>
                {planItems.some((item) => item.id === selected.id) ? "Remove from My Day" : "Add to My Day"}
              </button>
              <a className="btn-ghost" href={selected.mapUrl} target="_blank" rel="noreferrer">
                <IconPin style={{ width: 15, height: 15 }} />
                Directions
              </a>
            </div>
          </aside>
        </div>
      )}

      {/* --------------------------------------------------- My Day drawer */}
      {planOpen && (
        <div className="scrim">
          <button type="button" className="scrim-hit" onClick={closePlan} aria-label="Close planner" />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="My Day planner" ref={planRef} tabIndex={-1}>
            <div className="drawer-top">
              <strong>My Day · {planCount} {planCount === 1 ? "stop" : "stops"}</strong>
              <button type="button" className="icon-btn" onClick={closePlan} aria-label="Close planner">
                <IconX />
              </button>
            </div>

            <div className="drawer-scroll">
              <div className="drawer-body">
                {planCount === 0 ? (
                  <div className="empty">
                    <h3>Build your day</h3>
                    <p>
                      Tap the <strong>+</strong> on any event card to line up stops. Your itinerary stays on this device, so you can
                      close the tab and come back to it.
                    </p>
                    <button type="button" className="btn-solid" onClick={closePlan}>
                      Browse events
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="itin">
                      {planItems.map((item, index) => {
                        const stop = eventById.get(item.id);
                        return (
                        <div className="itin-row" key={item.id}>
                          <div className="itin-rail">
                            <span className="itin-num">{index + 1}</span>
                            <span className="itin-line" />
                          </div>
                          <div className={stop ? "itin-card" : "itin-card unavailable"}>
                            <div style={{ minWidth: 0 }}>
                              <span className="itin-time">{stop?.time ?? "Unavailable"}</span>
                              <h4>{stop?.title ?? item.title}</h4>
                              <p>
                                {stop ? `${stop.venue} · ${stop.town} — ${stop.distance} mi` : "This event is no longer in the current listings."}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => removePlanItem(item.id, stop?.title ?? item.title)}
                              aria-label={`Remove ${stop?.title ?? item.title} from My Day`}
                            >
                              <IconX />
                            </button>
                          </div>
                        </div>
                      );})}
                    </div>
                    <p style={{ margin: 0, color: "var(--text-3)", fontSize: 12.5 }}>
                      {plan.length === 1 && unavailablePlan.length === 0
                        ? `${plan[0].distance} miles from Orchard Park.`
                        : plan.length > 0 ? `Available stops range ${Math.min(...plan.map((stop) => stop.distance))}–${Math.max(
                            ...plan.map((stop) => stop.distance),
                          )} miles from Orchard Park.` : "Saved stops are currently unavailable."}
                    </p>
                  </>
                )}
              </div>
            </div>

            {planCount > 0 && (
              <div className="drawer-foot">
                <button type="button" className="btn-solid" onClick={copyItinerary}>
                  <IconCopy style={{ width: 15, height: 15 }} />
                  Copy itinerary
                </button>
                <button type="button" className="btn-ghost" onClick={clearPlan}>
                  Clear
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ---------------------------------------------- mobile filter sheet */}
      {sheetOpen && (
        <div className="scrim bottom">
          <button type="button" className="scrim-hit" onClick={closeSheet} aria-label="Close filters" />
          <aside className="sheet" role="dialog" aria-modal="true" aria-label="Filters" ref={sheetRef} tabIndex={-1}>
            <span className="sheet-grab" aria-hidden="true" />
            <div className="drawer-top" style={{ background: "transparent", border: 0 }}>
              <strong>Refine</strong>
              <button type="button" className="icon-btn" onClick={closeSheet} aria-label="Close filters">
                <IconX />
              </button>
            </div>

            <div className="sheet-scroll">
              <div className="sheet-group">
                <h4>Drive time from Orchard Park</h4>
                <div className="sheet-chips">
                  {[null, 5, 10, 15].map((option) => (
                    <button
                      key={String(option)}
                      type="button"
                      aria-pressed={maxDistance === option}
                      onClick={() => setMaxDistance(option)}
                    >
                      {option === null ? `Up to 25 mi · ~${driveMinutes(25)} min` : `Up to ${option} mi · ~${driveMinutes(option)} min`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sheet-group">
                <h4>Activity</h4>
                <div className="sheet-chips">
                  {KIND_OPTIONS.map((option) => (
                    <button key={option} type="button" aria-pressed={kind === option} onClick={() => setKind(option)}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sheet-group">
                <h4>Setting</h4>
                <div className="sheet-chips">
                  {(["all", "indoor", "outdoor"] as SettingFilter[]).map((option) => (
                    <button key={option} type="button" aria-pressed={setting === option} onClick={() => setSetting(option)}>
                      {option === "all" ? "Indoor + outdoor" : option === "indoor" ? "Indoor" : "Outdoor"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sheet-group">
                <h4>Sort</h4>
                <div className="sheet-chips">
                  {(["recommended", "closest"] as Sort[]).map((option) => (
                    <button key={option} type="button" aria-pressed={sort === option} onClick={() => setSort(option)}>
                      {option === "recommended" ? "Recommended" : "Closest first"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="drawer-foot">
              <button type="button" className="btn-solid" onClick={closeSheet}>
                Show {filtered.length} {filtered.length === 1 ? "event" : "events"}
              </button>
              <button type="button" className="btn-ghost" onClick={clearAll} disabled={activeFilters.length === 0}>
                Reset
              </button>
            </div>
          </aside>
        </div>
      )}

      <button type="button" className="fab" onClick={() => setPlanOpen(true)} data-modal-background>
        <IconRoute />
        My Day
        {planCount > 0 && <span className="pill-count">{planCount}</span>}
      </button>

      {notice && (
        <div className="toast" role="status" aria-live="polite">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            <IconX style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
    </>
  );
}
