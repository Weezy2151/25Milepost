"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import {
  fallbackEvents,
  SNAPSHOT_DATE,
  type EventKind,
  type EventPick,
  type SettingFilter,
  type Sort,
  type Vibe,
} from "./events-data";

/* ------------------------------------------------------------------ icons */

type IconProps = SVGProps<SVGSVGElement>;
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const IconSearch = (p: IconProps) => <svg {...svg} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
const IconX = (p: IconProps) => <svg {...svg} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>;
const IconChevron = (p: IconProps) => <svg {...svg} {...p}><path d="m6 9 6 6 6-6" /></svg>;
const IconCheck = (p: IconProps) => <svg {...svg} {...p}><path d="m20 6-11 11-5-5" /></svg>;
const IconClock = (p: IconProps) => <svg {...svg} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const IconPin = (p: IconProps) => <svg {...svg} {...p}><path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.8" /></svg>;
const IconBookmark = (p: IconProps) => <svg {...svg} {...p}><path d="M6 4h12v17l-6-4.2L6 21V4Z" /></svg>;
const IconPlus = (p: IconProps) => <svg {...svg} {...p}><path d="M12 5v14M5 12h14" /></svg>;
const IconRoute = (p: IconProps) => <svg {...svg} {...p}><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M15.5 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8.5" /></svg>;
const IconShare = (p: IconProps) => <svg {...svg} {...p}><path d="M12 15V3m0 0L8 7m4-4 4 4" /><path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /></svg>;
const IconSun = (p: IconProps) => <svg {...svg} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
const IconMoon = (p: IconProps) => <svg {...svg} {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></svg>;
const IconExternal = (p: IconProps) => <svg {...svg} {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;
const IconSparkle = (p: IconProps) => <svg {...svg} {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /></svg>;
const IconTicket = (p: IconProps) => <svg {...svg} {...p}><path d="M4 9V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a3 3 0 0 0 0 6v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a3 3 0 0 0 0-6Z" /></svg>;
const IconCopy = (p: IconProps) => <svg {...svg} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></svg>;

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

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Misty";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain possible";
  if (code <= 77) return "Wintry";
  if (code >= 95) return "Storms possible";
  return "Changeable skies";
}

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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Modal plumbing for the drawers and sheet: locks page scroll, closes on
 * Escape, keeps Tab inside the panel, and hands focus back to whatever opened
 * it. Without the trap, keyboard and screen-reader users tab straight through
 * the scrim into the page behind.
 */
function useModal(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => el.offsetParent !== null);
    // Focus the panel itself rather than its close button, so screen readers
    // announce the dialog label before any control.
    panel?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey, true);
      // Only steal focus back if it is still inside the panel we are closing.
      if (!document.activeElement || document.activeElement === document.body) opener?.focus();
    };
  }, [open, onClose]);

  return panelRef;
}

/* ------------------------------------------------------------ filter menu */

type Option = { value: string; label: string };

function FilterMenu({
  label,
  options,
  selected,
  defaultValue,
  align = "left",
  onSelect,
}: {
  label: string;
  options: Option[];
  selected: string;
  defaultValue: string;
  align?: "left" | "right";
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = selected !== defaultValue;
  const current = options.find((option) => option.value === selected);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="fmenu" ref={ref}>
      <button
        type="button"
        className={active ? "fmenu-btn on" : "fmenu-btn"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <b>{active ? current?.label : "Any"}</b>
        <IconChevron />
      </button>
      {open && (
        <div className={align === "right" ? "fmenu-panel right" : "fmenu-panel"} role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === selected}
              className="fmenu-opt"
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
            >
              {option.label}
              {option.value === selected && <IconCheck />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- event card */

function EventCard({
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
          <img src={event.image} alt="" />
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
        <button type="button" className="card-title" onClick={() => onOpen(event)}>
          {event.title}
        </button>
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
            title={inPlan ? "Remove from My Day" : "Add to My Day"}
          >
            {inPlan ? <IconCheck /> : <IconPlus />}
          </button>
          <button
            type="button"
            className={isSaved ? "icon-btn on" : "icon-btn"}
            onClick={() => onToggleSave(event.id)}
            aria-pressed={isSaved}
            title={isSaved ? "Remove from saved" : "Save for later"}
          >
            <IconBookmark />
          </button>
          <a className="icon-btn" href={event.mapUrl} target="_blank" rel="noreferrer" title={`Directions to ${event.venue}`}>
            <IconPin />
          </a>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="sk" aria-hidden="true">
      <div className="sk-media" />
      <div className="sk-body">
        <div className="sk-line" style={{ width: "40%" }} />
        <div className="sk-line" style={{ width: "88%", height: 18 }} />
        <div className="sk-line" style={{ width: "62%" }} />
        <div className="sk-line" style={{ width: "100%" }} />
        <div className="sk-line" style={{ width: "76%" }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- home page */

/** What the API said about its own currency: fresh, stale, or a rescued copy. */
type Freshness = { state: "fresh" | "stale" | "last-good"; ageSeconds: number; builtFor: string } | null;

/** One day of the forecast, keyed by ISO date so events can look themselves up. */
type DayForecast = { dateKey: string; label: string; high: number; low: number; rain: number; code: number };
type Weather = { label: string; now: number; high: number; rain: number; days: DayForecast[] } | null;

/** Short weather note for an event's own date — only worth showing outdoors. */
function forecastFor(event: EventPick, days: DayForecast[]) {
  if (!event.dateKey || event.setting === "indoor") return null;
  return days.find((day) => day.dateKey === event.dateKey) ?? null;
}

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
  const [freshness, setFreshness] = useState<Freshness>(null);

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
  const [plan, setPlan] = useState<EventPick[]>([]);
  const [selected, setSelected] = useState<EventPick | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [greeting, setGreeting] = useState("Hello, Orchard Park.");
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [weather, setWeather] = useState<Weather>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [notice, setNotice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---- boot: local state, greeting, feeds ---- */

  useEffect(() => {
    // Storage is read after mount (not in a state initialiser) so the server and
    // client render the same first pass; the extra render is the point, not a bug.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const storedSaved = window.localStorage.getItem(SAVED_KEY);
      if (storedSaved) setSaved(JSON.parse(storedSaved));
      const storedPlan = window.localStorage.getItem(PLAN_KEY);
      if (storedPlan) setPlan(JSON.parse(storedPlan));
      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
    } catch {
      /* storage unavailable — carry on with defaults */
    }

    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning, Orchard Park." : hour < 17 ? "Good afternoon, Orchard Park." : "Good evening, Orchard Park.");

    (async () => {
      try {
        const response = await fetch("/api/events?edition=balanced-v3");
        if (!response.ok) throw new Error("refresh failed");
        const data = await response.json();
        if (Array.isArray(data.events) && data.events.length) {
          setEvents(data.events);
          setUpdatedAt(data.updatedAt);
          const sources: Array<{ ok: boolean }> = Array.isArray(data.sources) ? data.sources : [];
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
        setLoading(false);
      }
    })();

    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.767&longitude=-78.744&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=8",
    )
      .then((response) => response.json())
      .then((data) => {
        const daily = data.daily ?? {};
        const days: DayForecast[] = (daily.time ?? []).map((dateKey: string, index: number) => ({
          dateKey,
          label: weatherLabel(daily.weather_code?.[index] ?? 0),
          high: Math.round(daily.temperature_2m_max?.[index] ?? 0),
          low: Math.round(daily.temperature_2m_min?.[index] ?? 0),
          rain: daily.precipitation_probability_max?.[index] ?? 0,
          code: daily.weather_code?.[index] ?? 0,
        }));
        setWeather({
          label: weatherLabel(data.current.weather_code),
          now: Math.round(data.current.temperature_2m),
          high: days[0]?.high ?? 0,
          rain: days[0]?.rain ?? 0,
          days,
        });
      })
      .catch(() => setWeather(null));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ---- filtering ---- */

  const matchesVibe = useCallback((event: EventPick, choice: Vibe) => {
    if (choice === "all") return true;
    const text = `${event.title} ${event.description} ${event.tags.join(" ")} ${event.kind || ""}`.toLowerCase();
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
    const needle = query.trim().toLowerCase();
    const list = events.filter((event) => {
      if (kind !== "All activities" && event.kind !== kind && !(!event.kind && event.tags.includes(kind))) return false;
      if (setting !== "all" && event.setting !== setting && event.setting !== "both" && event.setting) return false;
      if (maxDistance !== null && event.distance > maxDistance) return false;
      if (!matchesVibe(event, vibe)) return false;
      if (showSaved && !saved.includes(event.id)) return false;
      if (needle) {
        const text = `${event.title} ${event.description} ${event.venue} ${event.town} ${event.tags.join(" ")}`.toLowerCase();
        if (!text.includes(needle)) return false;
      }
      return true;
    });
    if (sort === "closest") return [...list].sort((a, b) => a.distance - b.distance);
    return list;
  }, [events, kind, setting, maxDistance, vibe, showSaved, saved, query, sort, matchesVibe]);

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
    () => weather?.days.find((day) => day.dateKey === activeDay) ?? null,
    [weather, activeDay],
  );
  const viewingToday = activeDay === todayKey;
  const rainLikely = dayForecast !== null && dayForecast.rain >= 40;

  /* ---- actions ---- */

  const persist = (key: string, value: unknown) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked — state still works for this session */
    }
  };

  const toggleSave = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    persist(SAVED_KEY, next);
    setNotice(saved.includes(id) ? "Removed from saved." : "Saved to this device.");
  };

  const togglePlan = (event: EventPick) => {
    const exists = plan.some((item) => item.id === event.id);
    const next = exists ? plan.filter((item) => item.id !== event.id) : [...plan, event];
    setPlan(next);
    persist(PLAN_KEY, next);
    setNotice(exists ? `Removed “${event.title}” from My Day.` : `Added “${event.title}” to My Day.`);
  };

  const clearPlan = () => {
    setPlan([]);
    persist(PLAN_KEY, []);
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
    const text = plan.map((stop, index) => `${index + 1}. ${stop.title} (${stop.time}) — ${stop.venue}, ${stop.town}`).join("\n");
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

  const closeDetails = useCallback(() => setSelected(null), []);
  const closePlan = useCallback(() => setPlanOpen(false), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const detailRef = useModal(selected !== null, closeDetails);
  const planRef = useModal(planOpen, closePlan);
  const sheetRef = useModal(sheetOpen, closeSheet);

  const cardProps = (event: EventPick) => ({
    event,
    isSaved: saved.includes(event.id),
    inPlan: plan.some((item) => item.id === event.id),
    forecast: weather ? forecastFor(event, weather.days) : null,
    onToggleSave: toggleSave,
    onTogglePlan: togglePlan,
    onOpen: setSelected,
  });

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

      <header className="topbar">
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
            <button type="button" className="icon-btn topbar-search" onClick={focusSearch} title="Search events">
              <IconSearch />
            </button>
            <button
              type="button"
              className={theme === "dark" ? "icon-btn on" : "icon-btn"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            <button type="button" className="icon-btn" onClick={share} title="Share this guide">
              <IconShare />
            </button>
            <button
              type="button"
              className={plan.length ? "icon-btn on topbar-myday" : "icon-btn topbar-myday"}
              onClick={() => setPlanOpen(true)}
            >
              <IconRoute />
              My Day
              {plan.length > 0 && <span className="pill-count">{plan.length}</span>}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
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
              <div className="wcard">
                <div className="wcard-head">
                  <span className={loading ? "live-dot busy" : "live-dot"} />
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
        <section className="wrap section" id="results" aria-label={`Events on ${activeDayMeta?.date ?? "the selected day"}`}>
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

          {loading && events.length === 0 ? (
            <div className="grid">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid">
              {filtered.map((event) => (
                <EventCard key={event.id} {...cardProps(event)} />
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

      <footer className="footer">
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
                  <img src={selected.image} alt="" />
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
                {plan.some((item) => item.id === selected.id) ? "Remove from My Day" : "Add to My Day"}
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
              <strong>My Day · {plan.length} {plan.length === 1 ? "stop" : "stops"}</strong>
              <button type="button" className="icon-btn" onClick={closePlan} aria-label="Close planner">
                <IconX />
              </button>
            </div>

            <div className="drawer-scroll">
              <div className="drawer-body">
                {plan.length === 0 ? (
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
                      {plan.map((stop, index) => (
                        <div className="itin-row" key={stop.id}>
                          <div className="itin-rail">
                            <span className="itin-num">{index + 1}</span>
                            <span className="itin-line" />
                          </div>
                          <div className="itin-card">
                            <div style={{ minWidth: 0 }}>
                              <span className="itin-time">{stop.time}</span>
                              <h4>{stop.title}</h4>
                              <p>
                                {stop.venue} · {stop.town} — {stop.distance} mi
                              </p>
                            </div>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => togglePlan(stop)}
                              aria-label={`Remove ${stop.title} from My Day`}
                            >
                              <IconX />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p style={{ margin: 0, color: "var(--text-3)", fontSize: 12.5 }}>
                      {plan.length === 1
                        ? `${plan[0].distance} miles from Orchard Park.`
                        : `Stops range ${Math.min(...plan.map((stop) => stop.distance))}–${Math.max(
                            ...plan.map((stop) => stop.distance),
                          )} miles from Orchard Park.`}
                    </p>
                  </>
                )}
              </div>
            </div>

            {plan.length > 0 && (
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

      <button type="button" className="fab" onClick={() => setPlanOpen(true)}>
        <IconRoute />
        My Day
        {plan.length > 0 && <span className="pill-count">{plan.length}</span>}
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
