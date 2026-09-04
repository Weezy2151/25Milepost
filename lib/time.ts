/**
 * Reading clock times out of event listings.
 *
 * Feeds hand over times in whatever shape their publisher likes — "2 PM",
 * "4:30–6:30 PM", "10:30 or 11:30 AM", "During library hours". The page needs
 * real numbers to sort by start time, to say what is happening now, and to
 * export a calendar entry, so this module turns those strings into minutes past
 * local midnight.
 *
 * Everything this app covers sits in a single timezone (America/New_York), so
 * minutes-of-day is the whole story — no instants, no second timezone surface
 * to keep in step with `dateKey`.
 *
 * The parser never guesses. A listing whose time cannot be read yields `null`,
 * which callers treat as "unknown" (sorted last, never shown as happening now,
 * exported as an all-day calendar entry) rather than as midnight.
 */

/** Minutes past local midnight, or null when the listing has no readable clock. */
export type EventMinutes = {
  startMinutes: number | null;
  endMinutes: number | null;
};

export const UNKNOWN_TIME: EventMinutes = { startMinutes: null, endMinutes: null };

/** Wording publishers use for events that occupy the whole day rather than a slot. */
const ALL_DAY = /^\s*(all[-\s]?day|during .*hours|open .*hours)/i;

/**
 * One clock reading. `meridiem` is null when the token was written without one
 * ("7" in "7–9 PM"), which is the common way to write a range.
 */
type Clock = { hour: number; minute: number; meridiem: "am" | "pm" | null; index: number };

const CLOCK = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi;

function readClocks(value: string): Clock[] {
  const clocks: Clock[] = [];
  for (const match of value.matchAll(CLOCK)) {
    const hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    // A 24-hour-looking figure or a stray number (a year, a street number) is
    // not a clock reading this app can trust.
    if (hour < 1 || hour > 12 || minute > 59) continue;
    const suffix = match[3]?.toLowerCase().replace(/\./g, "") ?? "";
    clocks.push({
      hour,
      minute,
      meridiem: suffix === "am" ? "am" : suffix === "pm" ? "pm" : null,
      index: match.index ?? 0,
    });
  }
  return clocks;
}

function toMinutes(hour: number, minute: number, meridiem: "am" | "pm") {
  const hour24 = meridiem === "pm" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  return hour24 * 60 + minute;
}

/**
 * Resolve a clock that carries no AM/PM of its own.
 *
 * Ranges are conventionally written with a single meridiem at the end
 * ("4:30–6:30 PM" means both are PM), so an unmarked reading borrows from the
 * next marked one. When borrowing would put the start *after* the end
 * ("11–1 PM" — an 11 AM start), fall back to the meridiem that keeps the range
 * moving forward.
 */
function resolve(clock: Clock, borrowed: "am" | "pm" | null): number | null {
  const meridiem = clock.meridiem ?? borrowed;
  if (!meridiem) return null;
  return toMinutes(clock.hour, clock.minute, meridiem);
}

/**
 * Parse a listing's display time into start and end minutes.
 *
 * @param time The `time` string as shown on the card, e.g. "7–10 PM · film at sunset".
 */
export function parseEventTime(time: string | undefined | null): EventMinutes {
  if (!time) return UNKNOWN_TIME;
  if (ALL_DAY.test(time)) return UNKNOWN_TIME;

  const clocks = readClocks(time);
  if (clocks.length === 0) return UNKNOWN_TIME;

  const first = clocks[0];
  // The meridiem an unmarked opening reading should inherit: the next one that
  // states its own.
  const stated = clocks.find((clock) => clock.meridiem !== null)?.meridiem ?? null;

  let startMinutes = resolve(first, stated);
  if (startMinutes === null) return UNKNOWN_TIME;

  // A second reading is an end time only when it is part of a range. "10:30 or
  // 11:30 AM" offers two start times and "6:35 PM first pitch" trails prose, so
  // require a range separator between the two readings.
  const second = clocks[1];
  let endMinutes: number | null = null;
  if (second) {
    const between = time.slice(first.index, second.index);
    if (/[–—-]|\bto\b|\buntil\b/i.test(between)) {
      endMinutes = resolve(second, second.meridiem ?? stated);
    }
  }

  // "11–1 PM" borrowed PM for the start and produced a backwards range; the
  // opening reading must have been AM.
  if (endMinutes !== null && startMinutes > endMinutes && first.meridiem === null) {
    const corrected = resolve({ ...first, meridiem: "am" }, "am");
    if (corrected !== null && corrected <= endMinutes) startMinutes = corrected;
  }

  // An end before its start is not a range this app can use (an event running
  // past midnight is described by its start alone).
  if (endMinutes !== null && endMinutes < startMinutes) endMinutes = null;

  return { startMinutes, endMinutes };
}

/** Convenience for callers that only care when the event begins. */
export function parseStartMinutes(time: string | undefined | null): number | null {
  return parseEventTime(time).startMinutes;
}

/** Format minutes past midnight back into the app's display style ("4:30 PM"). */
export function formatMinutes(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return minute === 0 ? `${hour} ${meridiem}` : `${hour}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

/**
 * How long after its start an event with no stated end is still treated as
 * running.
 *
 * Plenty of listings give only a start ("10:30 AM" for a storytime, "11 AM"
 * for a fair that runs all afternoon). Dropping those out of the day the
 * minute their start passes would hide events that are still going, so they
 * get an hour and a half of benefit of the doubt.
 */
export const UNKNOWN_END_GRACE_MINUTES = 90;

export type EventStatus = "unknown" | "upcoming" | "now" | "past";

/**
 * Where an event sits relative to the current time, for events on today's
 * date only — the caller decides which day is today.
 */
export function eventStatus({ startMinutes, endMinutes }: EventMinutes, nowMinutes: number): EventStatus {
  if (startMinutes === null) return "unknown";
  if (nowMinutes < startMinutes) return "upcoming";
  const end = endMinutes ?? startMinutes + UNKNOWN_END_GRACE_MINUTES;
  return nowMinutes <= end ? "now" : "past";
}

/** Minutes until an event starts, or null when it has started or has no clock. */
export function minutesUntil(startMinutes: number | null, nowMinutes: number) {
  if (startMinutes === null || startMinutes <= nowMinutes) return null;
  return startMinutes - nowMinutes;
}

/** "in 25 min", "in 1 hr", "in 2 hr 15 min" — how the cards count down. */
export function formatCountdown(minutes: number) {
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours} hr` : `in ${hours} hr ${rest} min`;
}

/** Local wall-clock time as minutes past midnight. */
export function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}
