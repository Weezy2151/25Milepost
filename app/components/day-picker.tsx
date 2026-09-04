"use client";

import { useRef } from "react";

import { WEEKEND } from "../../lib/filter";
import type { DayForecast } from "../../lib/weather";
import { weatherEmoji } from "../../lib/weather";

export type DayTile = { dateKey: string; day: string; date: string };

/** The week's days, each tile carrying its own sky and event count. */
export function DayPicker({
  days,
  activeDay,
  dayCounts,
  dayWeather,
  weekendKeys,
  onSelect,
}: {
  days: DayTile[];
  activeDay: string;
  dayCounts: Map<string, number>;
  dayWeather: Map<string, DayForecast>;
  /** Saturday and Sunday among the days on offer. */
  weekendKeys: ReadonlySet<string>;
  onSelect: (dateKey: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  /** Arrow keys move along the week; Home and End jump to its ends. */
  // "This weekend" sits at the end of the row and is selectable like any day.
  const options = weekendKeys.size > 0 ? [...days.map((day) => day.dateKey), WEEKEND] : days.map((day) => day.dateKey);
  const weekendCount = [...weekendKeys].reduce((total, key) => total + (dayCounts.get(key) ?? 0), 0);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const index = options.indexOf(activeDay);
    if (index === -1) return;
    event.preventDefault();

    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? options.length - 1
      : (index + step + options.length) % options.length;

    onSelect(options[next]);
    // Move focus with the selection, as a radio group does.
    listRef.current?.querySelectorAll("button")[next]?.focus();
  };

  return (
    <section className="wrap daypicker-wrap" aria-label="Choose a day">
      <p className="daypicker-label">Pick a day this week</p>
      <div className="daypicker" role="radiogroup" aria-label="Day of the week" tabIndex={-1} ref={listRef} onKeyDown={onKeyDown}>
        {days.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            className="daypicker-btn"
            role="radio"
            aria-checked={day.dateKey === activeDay}
            // One tab stop for the whole row; the arrow keys move within it,
            // which is what a radio group is expected to do.
            tabIndex={day.dateKey === activeDay ? 0 : -1}
            onClick={() => onSelect(day.dateKey)}
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

        {weekendKeys.size > 0 && (
          <button
            type="button"
            className="daypicker-btn daypicker-weekend"
            role="radio"
            aria-checked={activeDay === WEEKEND}
            tabIndex={activeDay === WEEKEND ? 0 : -1}
            onClick={() => onSelect(WEEKEND)}
          >
            <b>WEEKEND</b>
            <span>Sat + Sun</span>
            <em>{weekendCount}</em>
          </button>
        )}
      </div>
    </section>
  );
}
