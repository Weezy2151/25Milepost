"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { parseEventsPayload, parseStoredIds, parseStoredPlan, parseWeatherPayload, type StoredPlanItem } from "../lib/client-data";
import type { Freshness } from "../lib/events";
import type { Weather } from "../lib/weather";
import { eventStatus, nowMinutes } from "../lib/time";
import { fallbackEvents } from "./events-data";
import {
  activeCriteria,
  buildSearchIndex,
  DEFAULT_VIEW,
  resolveSort,
  eventMinutes,
  filterEvents,
  isFree,
  viewReducer,
  type EventPick,
  type FilterCriteria,
} from "../lib/filter";
import { DayPicker } from "./components/day-picker";
import { EventCard } from "./components/event-card";
import { EventDrawer } from "./components/event-drawer";
import { FilterBar } from "./components/filter-bar";
import { FilterSheet } from "./components/filter-sheet";
import { Hero } from "./components/hero";
import { MyDayDrawer } from "./components/my-day-drawer";
import { Sources } from "./components/sources";
import { Spotlight } from "./components/spotlight";
import { IconChevron, IconMoon, IconRoute, IconSearch, IconShare, IconSun, IconX } from "./components/icons";
import { useModal } from "./components/use-modal";

/* -------------------------------------------------------------- home page */

const SAVED_KEY = "twenty-five-mile-post-clippings";
const PLAN_KEY = "twenty-five-mile-post-myday";
const THEME_KEY = "twenty-five-mile-post-theme";

function persist(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — state still works for this session */
  }
}

export default function Home() {
  // Do not render the bundled snapshot as if it were today's data. A cold
  // function can take several seconds to answer; showing expired cards during
  // that window is worse than a brief empty/loading state.
  const [events, setEvents] = useState<EventPick[]>([]);
  const [loading, setLoading] = useState(true);
  /** "snapshot" until live calendars answer, so the UI can say which it is showing. */
  const [feed, setFeed] = useState<{ state: "snapshot" | "live"; ok: number; total: number }>({
    state: "snapshot",
    ok: 0,
    total: 0,
  });
  /** How current the API said its payload was — see `freshness` in the route. */
  const [freshness, setFreshness] = useState<Freshness | null>(null);

  /**
   * Filters and the selected day travel together as one value, so there is a
   * single place to read them from when serializing the view into the URL.
   * `day` is null until the visitor picks one, meaning "whichever day the
   * current event set flags as today".
   */
  const [view, dispatch] = useReducer(viewReducer, DEFAULT_VIEW);
  const { kind, setting, vibe, maxDistance, sort, query, showSaved, day: selectedDay } = view;

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
        if (data) {
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
        // If live calendars fail, show the bundled safety net with its explicit
        // stale-data banner rather than silently leaving the loading state.
        if (!controller.signal.aborted) setEvents(fallbackEvents);
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

  /**
   * Local time as minutes past midnight, refreshed each minute.
   *
   * Null until it is read after mount, so the server and the first client pass
   * render the same markup — a card cannot say "happening now" in HTML that
   * was generated hours earlier.
   */
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setClock(nowMinutes());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  /* ---- filtering ---- */

  const searchableEvents = useMemo(() => buildSearchIndex(events), [events]);

  /** The week's days in order, one tile per distinct date the current event set covers. */
  const days = useMemo(() => {
    const seen = new Map<string, { dateKey: string; day: string; date: string }>();
    for (const event of events) {
      if (event.dateKey && !seen.has(event.dateKey)) {
        // Event display strings may describe a multi-day range; day tiles must
        // always represent the individual date they select.
        const date = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
          .format(new Date(`${event.dateKey}T12:00:00Z`));
        seen.set(event.dateKey, { dateKey: event.dateKey, day: event.day, date });
      }
    }
    return [...seen.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey)).slice(0, 8);
  }, [events]);

  /** Forecast keyed by date, so each day tile can carry its own sky. */
  const dayWeather = useMemo(() => new Map((weather?.days ?? []).map((day) => [day.dateKey, day])), [weather]);

  const todayKey = useMemo(() => events.find((event) => event.today)?.dateKey ?? days[0]?.dateKey ?? "", [events, days]);
  const activeDay = selectedDay ?? todayKey;

  const viewingToday = activeDay === todayKey;

  /**
   * "auto" means chronological while you are looking at today, where the next
   * thing on is the useful answer, and the editorial order for a day you are
   * planning ahead for. An explicit choice is always honoured.
   */
  const resolvedSort = resolveSort(sort, viewingToday);

  /**
   * Every filter except which day is selected — used both for the results list
   * and to count how many events each day tab would show, so the two can never
   * disagree. The rules themselves live in `lib/filter.ts`, where they are
   * unit-tested.
   */
  const criteria: FilterCriteria = useMemo(
    () => ({ kind, setting, vibe, maxDistance, sort: resolvedSort, query: deferredQuery, showSaved }),
    [kind, setting, vibe, maxDistance, resolvedSort, deferredQuery, showSaved],
  );

  const baseFiltered = useMemo(
    () => filterEvents(searchableEvents, criteria, savedSet),
    [searchableEvents, criteria, savedSet],
  );

  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of baseFiltered) {
      if (!event.dateKey) continue;
      counts.set(event.dateKey, (counts.get(event.dateKey) ?? 0) + 1);
    }
    return counts;
  }, [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter((event) => event.dateKey === activeDay), [baseFiltered, activeDay]);

  /**
   * On today, split what is still to come from what has already been. An
   * event you have missed is not a suggestion, but it is still worth being
   * able to see — a festival you thought started later, say — so it moves
   * behind a disclosure rather than out of the page.
   */
  const [upcoming, earlier] = useMemo(() => {
    if (!viewingToday || clock === null) return [filtered, [] as EventPick[]];
    const ahead: EventPick[] = [];
    const past: EventPick[] = [];
    for (const event of filtered) {
      (eventStatus(eventMinutes(event), clock) === "past" ? past : ahead).push(event);
    }
    return [ahead, past];
  }, [filtered, viewingToday, clock]);

  const [showEarlier, setShowEarlier] = useState(false);

  const spotlight = useMemo(() => events.filter((event) => (event.priority ?? 0) >= 8).slice(0, 3), [events]);

  /* ---- derived UI state ---- */

  const activeFilters = useMemo(() => activeCriteria(view), [view]);

  const clearAll = () => dispatch({ type: "clearFilters" });

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
        <Hero
          greeting={greeting}
          loading={loading}
          eventCount={events.length}
          query={query}
          vibe={vibe}
          setting={setting}
          dispatch={dispatch}
          searchRef={searchRef}
          weather={weather}
          weatherLoading={weatherLoading}
          feed={feed}
          freshness={freshness}
          updatedAt={updatedAt}
          dayForecast={dayForecast}
          activeDayMeta={activeDayMeta}
          viewingToday={viewingToday}
          rainLikely={rainLikely}
          todayCount={todayCount}
          freeToday={freeToday}
          closeToday={closeToday}
        />
        {/* ------------------------------------------------------- day picker */}
        <DayPicker
          days={days}
          activeDay={activeDay}
          dayCounts={dayCounts}
          dayWeather={dayWeather}
          onSelect={(dateKey) => dispatch({ type: "day", value: dateKey })}
        />
        {/* ----------------------------------------------------- filter bar */}
        <FilterBar
          view={view}
          dispatch={dispatch}
          savedCount={saved.length}
          resultCount={filtered.length}
          viewingToday={viewingToday}
          onOpenSheet={() => setSheetOpen(true)}
          onClearAll={clearAll}
        />
        {/* ------------------------------------------------------ spotlight */}
        {showSpotlight && <Spotlight spotlight={spotlight} onOpen={setSelected} />}
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
            <>
              {upcoming.length > 0 && (
                <div className="grid">
                  {upcoming.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isSaved={savedSet.has(event.id)}
                      inPlan={planIds.has(event.id)}
                      forecast={event.dateKey && event.setting !== "indoor" ? dayWeather.get(event.dateKey) ?? null : null}
                      nowMinutes={viewingToday ? clock : null}
                      onToggleSave={toggleSave}
                      onTogglePlan={togglePlan}
                      onOpen={setSelected}
                    />
                  ))}
                </div>
              )}

              {earlier.length > 0 && (
                <div className="earlier">
                  <button type="button" className="earlier-toggle" aria-expanded={showEarlier} onClick={() => setShowEarlier(!showEarlier)}>
                    <IconChevron />
                    {showEarlier ? "Hide" : "Show"} {earlier.length} earlier {earlier.length === 1 ? "event" : "events"}
                    {upcoming.length === 0 && " — everything today has already started"}
                  </button>
                  {showEarlier && (
                    <div className="grid">
                      {earlier.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          isSaved={savedSet.has(event.id)}
                          inPlan={planIds.has(event.id)}
                          forecast={event.dateKey && event.setting !== "indoor" ? dayWeather.get(event.dateKey) ?? null : null}
                          nowMinutes={clock}
                          onToggleSave={toggleSave}
                          onTogglePlan={togglePlan}
                          onOpen={setSelected}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              <h3>Nothing that day matches those filters</h3>
              <p>Try another day above, widen the drive-time radius, or clear what&rsquo;s applied.</p>
              {(activeFilters.length > 0 || selectedDay !== null) && (
                <button
                  type="button"
                  className="btn-solid"
                  onClick={() => {
                    dispatch({ type: "resetAll" });
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------- sources */}
        <Sources />
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
        <EventDrawer
          selected={selected}
          isSaved={savedSet.has(selected.id)}
          inPlan={planIds.has(selected.id)}
          drawerRef={detailRef}
          onClose={closeDetails}
          onToggleSave={toggleSave}
          onTogglePlan={togglePlan}
        />
      )}
      {/* --------------------------------------------------- My Day drawer */}
      {planOpen && (
        <MyDayDrawer
          planItems={planItems}
          plan={plan}
          unavailablePlan={unavailablePlan}
          eventById={eventById}
          drawerRef={planRef}
          onClose={closePlan}
          onRemove={removePlanItem}
          onClear={clearPlan}
          onCopy={copyItinerary}
        />
      )}
      {/* ---------------------------------------------- mobile filter sheet */}
      {sheetOpen && (
        <FilterSheet
          view={view}
          dispatch={dispatch}
          activeCount={activeFilters.length}
          resultCount={filtered.length}
          viewingToday={viewingToday}
          sheetRef={sheetRef}
          onClose={closeSheet}
          onClearAll={clearAll}
        />
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
