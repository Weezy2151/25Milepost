/** Small RFC 5545 adapter covering timezone-aware starts and common recurrences. */

export type IcalOccurrence = {
  uid: string;
  dateKey: string;
  time: string;
  allDay: boolean;
  title: string;
  description: string;
  location: string;
  url: string;
};

type Property = { name: string; params: Record<string, string>; value: string };
type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const DAY_INDEX: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function unfold(value: string) {
  return value.replace(/\r?\n[ \t]/g, "");
}

function unescapeText(value: string) {
  return value.replace(/\\[nN]/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function properties(block: string): Property[] {
  return unfold(block).split(/\r?\n/).flatMap((line) => {
    const colon = line.indexOf(":");
    if (colon < 1) return [];
    const head = line.slice(0, colon).split(";");
    const name = head.shift()?.toUpperCase() ?? "";
    const params = Object.fromEntries(head.map((item) => {
      const equals = item.indexOf("=");
      return equals < 0 ? [item.toUpperCase(), ""] : [item.slice(0, equals).toUpperCase(), item.slice(equals + 1)];
    }));
    return [{ name, params, value: line.slice(colon + 1) }];
  });
}

function partsInZone(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: number("year"), month: number("month"), day: number("day"), hour: number("hour"), minute: number("minute"), second: number("second") };
}

/** Convert a wall-clock value in an IANA zone into an instant. */
function zonedInstant(parts: LocalParts, timeZone: string) {
  let epoch = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = partsInZone(new Date(epoch), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const wantedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const correction = wantedAsUtc - actualAsUtc;
    epoch += correction;
    if (correction === 0) break;
  }
  return new Date(epoch);
}

function rawParts(raw: string): LocalParts | null {
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/);
  if (!match) return null;
  return {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4] ?? 0), minute: Number(match[5] ?? 0), second: Number(match[6] ?? 0),
  };
}

function isoKey(parts: Pick<LocalParts, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatClock(parts: LocalParts) {
  const suffix = parts.hour >= 12 ? "PM" : "AM";
  const hour = parts.hour % 12 || 12;
  return `${hour}${parts.minute === 0 ? "" : `:${String(parts.minute).padStart(2, "0")}`} ${suffix}`;
}

function parseStart(property: Property, outputZone: string) {
  try {
    const parsed = rawParts(property.value);
    if (!parsed) return null;
    const allDay = property.params.VALUE?.toUpperCase() === "DATE" || !property.value.includes("T");
    if (allDay) return { instant: zonedInstant(parsed, outputZone), dateKey: isoKey(parsed), time: "All day", allDay };
    const sourceZone = property.value.endsWith("Z") ? "UTC" : property.params.TZID?.replace(/^"|"$/g, "") || outputZone;
    const instant = zonedInstant(parsed, sourceZone);
    const local = partsInZone(instant, outputZone);
    return { instant, dateKey: isoKey(local), time: formatClock(local), allDay };
  } catch {
    return null;
  }
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOfWeek(key: string) {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

function recurrenceDates(start: string, rule: string, from: string, to: string) {
  const values = Object.fromEntries(rule.split(";").map((part) => {
    const [key, value = ""] = part.split("=", 2);
    return [key.toUpperCase(), value];
  }));
  const frequency = values.FREQ;
  if (frequency !== "DAILY" && frequency !== "WEEKLY") return [start];
  const interval = Math.max(1, Number(values.INTERVAL) || 1);
  const untilRaw = rawParts(values.UNTIL ?? "");
  const until = untilRaw ? isoKey(untilRaw) : to;
  const limit = until < to ? until : to;
  const count = Math.max(1, Number(values.COUNT) || Number.POSITIVE_INFINITY);
  const byDays = (values.BYDAY ?? "").split(",").map((day) => DAY_INDEX[day.slice(-2)]).filter((day) => day !== undefined);
  const result: string[] = [];
  let generated = 0;
  for (let key = start; key <= limit && generated < count; key = addDays(key, 1)) {
    const daysSinceStart = Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
    let matches = frequency === "DAILY" ? daysSinceStart % interval === 0 : Math.floor(daysSinceStart / 7) % interval === 0;
    if (frequency === "WEEKLY") matches = matches && (byDays.length ? byDays.includes(dayOfWeek(key)) : dayOfWeek(key) === dayOfWeek(start));
    if (!matches) continue;
    generated += 1;
    if (key >= from) result.push(key);
  }
  return result;
}

export function parseIcalOccurrences(ics: string, from: string, to: string, outputZone = "America/New_York"): IcalOccurrence[] {
  return [...unfold(ics).matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)\r?\nEND:VEVENT/gi)].flatMap((match, index) => {
    const props = properties(match[1]);
    const one = (name: string) => props.find((property) => property.name === name);
    const startProperty = one("DTSTART");
    if (!startProperty) return [];
    const start = parseStart(startProperty, outputZone);
    if (!start) return [];
    const rule = one("RRULE")?.value;
    const exclusions = new Set(props.filter((property) => property.name === "EXDATE").flatMap((property) => property.value.split(",").map((value) => {
      const parsed = parseStart({ ...property, value }, outputZone);
      return parsed?.dateKey ?? "";
    })));
    const dates = rule ? recurrenceDates(start.dateKey, rule, from, to) : [start.dateKey];
    const title = unescapeText(one("SUMMARY")?.value ?? "");
    if (!title) return [];
    return dates.filter((dateKey) => dateKey >= from && dateKey <= to && !exclusions.has(dateKey)).map((dateKey) => ({
      uid: unescapeText(one("UID")?.value ?? `event-${index}`),
      dateKey,
      time: start.time,
      allDay: start.allDay,
      title,
      description: unescapeText(one("DESCRIPTION")?.value ?? ""),
      location: unescapeText(one("LOCATION")?.value ?? ""),
      url: unescapeText(one("URL")?.value ?? ""),
    }));
  });
}
