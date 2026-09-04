"use client";

import type { DayForecast } from "../../lib/weather";
import { weatherEmoji } from "../../lib/weather";

export type DayTile = { dateKey: string; day: string; date: string };

/** The week's days, each tile carrying its own sky and event count. */
export function DayPicker({
  days,
  activeDay,
  dayCounts,
  dayWeather,
  onSelect,
}: {
  days: DayTile[];
  activeDay: string;
  dayCounts: Map<string, number>;
  dayWeather: Map<string, DayForecast>;
  onSelect: (dateKey: string) => void;
}) {
  return (
    <section className="wrap daypicker-wrap" aria-label="Choose a day">
      <p className="daypicker-label">Pick a day this week</p>
      <div className="daypicker" role="group" aria-label="Day of the week">
        {days.map((day) => (
          <button
            key={day.dateKey}
            type="button"
            className="daypicker-btn"
            aria-pressed={day.dateKey === activeDay}
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
      </div>
    </section>
  );
}
