"use client";

import type { Dispatch, RefObject } from "react";

import type { Freshness } from "../../lib/events";
import { MOODS, type SettingFilter, type ViewAction, type Vibe } from "../../lib/filter";
import { dayAdvisory, RAIN_ADVISORY_PERCENT, type DayForecast, type Weather } from "../../lib/weather";
import { SNAPSHOT_DATE } from "../events-data";
import type { DayTile } from "./day-picker";
import { IconSearch, IconX } from "./icons";

/** How the API answered: the bundled snapshot, or live calendars. */
export type FeedState = { state: "snapshot" | "live"; ok: number; total: number };

/**
 * The top of the page: greeting, search, moods, live weather, the day's
 * numbers at a glance, and the advisories that tell a visitor when the
 * listings below cannot be trusted.
 */
export function Hero({
  greeting,
  loading,
  eventCount,
  query,
  vibe,
  setting,
  dispatch,
  searchRef,
  weather,
  weatherLoading,
  feed,
  freshness,
  updatedAt,
  dayForecast,
  activeDayMeta,
  viewingToday,
  todayCount,
  freeToday,
  closeToday,
  freeOnly,
  maxDistance,
  onShowToday,
}: {
  greeting: string;
  loading: boolean;
  eventCount: number;
  query: string;
  vibe: Vibe;
  setting: SettingFilter;
  dispatch: Dispatch<ViewAction>;
  searchRef: RefObject<HTMLInputElement | null>;
  weather: Weather | null;
  weatherLoading: boolean;
  feed: FeedState;
  freshness: Freshness | null;
  updatedAt: string;
  dayForecast: DayForecast | null;
  activeDayMeta: DayTile | undefined;
  viewingToday: boolean;
  todayCount: number;
  freeToday: number;
  closeToday: number;
  freeOnly: boolean;
  maxDistance: number | null;
  onShowToday: () => void;
}) {
  // The single most consequential thing about the day's weather, if anything.
  const advisory = dayAdvisory(dayForecast);

  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow">Today around Orchard Park · 25-mile radius</p>
          <h1 className="display hero-title">{greeting}</h1>
          <p className="hero-sub">
            Your local day, figured out. {loading ? <b>Loading live calendars…</b> : <><b>{eventCount} events</b> pulled from town calendars, libraries and community desks —
            refreshed each morning.</>}
          </p>

          <label className="search">
            <IconSearch />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => dispatch({ type: "query", value: event.target.value })}
              placeholder="Search farmers markets, live music, storytime…"
              aria-label="Search events"
            />
            {query && (
              <button type="button" className="search-clear" onClick={() => dispatch({ type: "query", value: "" })} aria-label="Clear search">
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
                onClick={() => dispatch({ type: "vibe", value: vibe === mood.id ? "all" : mood.id })}
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
                    <b className={dayForecast && dayForecast.rain >= RAIN_ADVISORY_PERCENT ? "warn-text" : undefined}>{dayForecast ? `${dayForecast.rain}%` : "—"}</b>
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

          {/*
            These three numbers are the questions people actually arrive with,
            so each one is the filter that answers it rather than a statistic
            to read and act on by hand.
          */}
          <div className="glance">
            <button
              type="button"
              className="glance-cell"
              aria-pressed={viewingToday}
              onClick={onShowToday}
              title="Show today's events"
            >
              <b>{todayCount}</b>
              <span>Today</span>
            </button>
            <button
              type="button"
              className="glance-cell"
              aria-pressed={freeOnly}
              onClick={() => dispatch({ type: "freeOnly", value: !freeOnly })}
              title={freeOnly ? "Show events at any price" : "Show only free events"}
            >
              <b>{freeToday}</b>
              <span>Free</span>
            </button>
            <button
              type="button"
              className="glance-cell"
              aria-pressed={maxDistance === 5}
              onClick={() => dispatch({ type: "maxDistance", value: maxDistance === 5 ? null : 5 })}
              title={maxDistance === 5 ? "Show the full 25-mile radius" : "Show only events within 5 miles"}
            >
              <b>{closeToday}</b>
              <span>Under 5 mi</span>
            </button>
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

      {advisory && (
        <div className="wrap">
          <div className="advisory">
            <p>
              {advisory.icon}{" "}
              <strong>
                {advisory.headline} {viewingToday ? "today" : `on ${activeDayMeta?.date ?? "that day"}`}.
              </strong>{" "}
              {advisory.suggestion}
            </p>
            {advisory.suggestsIndoor && (
              <button
                type="button"
                className={setting === "indoor" ? "on" : ""}
                onClick={() => dispatch({ type: "setting", value: setting === "indoor" ? "all" : "indoor" })}
              >
                {setting === "indoor" ? "Showing indoor only" : "Show indoor picks"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
