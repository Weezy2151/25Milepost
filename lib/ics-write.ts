/**
 * Writing iCalendar files, so an event can leave this page for a real calendar.
 *
 * `lib/ical.ts` reads other people's calendars; this writes ours. RFC 5545 is
 * particular in ways that are easy to get wrong and hard to notice — text has
 * to be escaped, lines folded at 75 octets, and a date-only event's end is the
 * day *after* it finishes — so the rules live here with tests rather than
 * inline in a route.
 */

import { eventMinutes, type EventPick } from "./filter.ts";
import { ZONE } from "./time.ts";

const PRODID = "-//The 25-Mile Post//Events//EN";

/**
 * Escape a value for a text property.
 *
 * Backslash first, or it would escape the escapes added after it.
 */
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to 75 octets, continuing with a leading space.
 *
 * Counted in UTF-8 bytes rather than characters, and never split inside one:
 * an event title with an accent or an emoji would otherwise be cut in half and
 * arrive as mojibake.
 */
export function foldLine(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Back off to a character boundary: continuation bytes are 10xxxxxx.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // continuation lines carry a leading space
  }
  return parts.join("\r\n ");
}

function localStamp(dateKey: string, minutes: number) {
  const date = dateKey.replace(/-/g, "");
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${date}T${hour}${minute}00`;
}

/** The day after the given key, for a date-only DTEND (which is exclusive). */
function nextDay(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** How long an event with no stated end is booked for. */
export const DEFAULT_EVENT_MINUTES = 90;

function eventLines(event: EventPick, now: Date, siteOrigin: string): string[] {
  const { startMinutes, endMinutes } = eventMinutes(event);
  const dateKey = event.dateKey;
  const lines: string[] = ["BEGIN:VEVENT"];

  lines.push(`UID:${event.id}@25milepost`);
  lines.push(`DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);

  if (dateKey && startMinutes !== null) {
    lines.push(`DTSTART;TZID=${ZONE}:${localStamp(dateKey, startMinutes)}`);
    const end = endMinutes ?? Math.min(startMinutes + DEFAULT_EVENT_MINUTES, 24 * 60 - 1);
    lines.push(`DTEND;TZID=${ZONE}:${localStamp(dateKey, end)}`);
  } else if (dateKey) {
    // No readable clock: an all-day entry, whose end date is exclusive.
    lines.push(`DTSTART;VALUE=DATE:${dateKey.replace(/-/g, "")}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(dateKey)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.title)}`);
  lines.push(`LOCATION:${escapeText(`${event.venue}, ${event.town}, NY`)}`);

  const description = [
    event.description,
    event.cost ? `Cost: ${event.cost}` : "",
    `Via ${event.source}`,
    event.url || `${siteOrigin}/#event-${encodeURIComponent(event.id)}`,
  ]
    .filter(Boolean)
    .join("\n");
  lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (event.url) lines.push(`URL:${event.url}`);

  lines.push("END:VEVENT");
  return lines;
}

/** One or more events as a complete iCalendar document. */
export function buildIcs(events: EventPick[], { siteOrigin, now = new Date(), name = "The 25-Mile Post" } = {} as {
  siteOrigin: string;
  now?: Date;
  name?: string;
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    ...events.flatMap((event) => eventLines(event, now, siteOrigin)),
    "END:VCALENDAR",
  ];
  // RFC 5545 wants CRLF line endings, and a trailing one.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * A Google Calendar "add event" link.
 *
 * Times are sent as UTC instants because that template takes no timezone, so
 * an event with no readable clock becomes an all-day entry instead.
 */
export function googleCalendarUrl(event: EventPick, siteOrigin: string) {
  const { startMinutes, endMinutes } = eventMinutes(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    location: `${event.venue}, ${event.town}, NY`,
    details: [event.description, `Via ${event.source}`, event.url || `${siteOrigin}/#event-${event.id}`]
      .filter(Boolean)
      .join("\n"),
  });

  if (event.dateKey) {
    if (startMinutes !== null) {
      const end = endMinutes ?? Math.min(startMinutes + DEFAULT_EVENT_MINUTES, 24 * 60 - 1);
      params.set("dates", `${localStamp(event.dateKey, startMinutes)}/${localStamp(event.dateKey, end)}`);
      params.set("ctz", ZONE);
    } else {
      params.set("dates", `${event.dateKey.replace(/-/g, "")}/${nextDay(event.dateKey)}`);
    }
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
