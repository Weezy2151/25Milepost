type LiveEvent = {
  id: string;
  area: "southtowns" | "city";
  town: string;
  day: string;
  date: string;
  dateKey: string;
  time: string;
  title: string;
  venue: string;
  distance: number;
  description: string;
  cost: string;
  source: string;
  url: string;
  mapUrl: string;
  tags: string[];
  accent: string;
  image?: string;
  today?: boolean;
};

const ZONE = "America/New_York";
const LIBRARY_FEEDS = [
  ["Library Programs", "https://buffalolib.libcal.com/rss.php?iid=4336&m=month&cid=12898"],
  ["Library Crafts", "https://buffalolib.libcal.com/rss.php?iid=4336&m=month&cid=16301"],
] as const;
const ICS_FEEDS = [
  ["Town of Orchard Park", "https://www.orchardparkny.gov/events/?ical=1", "southtowns"],
  ["Buffalo Special Events", "https://www.buffalony.gov/common/modules/iCalendar/iCalendar.aspx?catID=34&feed=calendar", "city"],
  ["Buffalo City Events", "https://www.buffalony.gov/common/modules/iCalendar/iCalendar.aspx?catID=24&feed=calendar", "city"],
  ["Buffalo Sponsored Events", "https://www.buffalony.gov/common/modules/iCalendar/iCalendar.aspx?catID=32&feed=calendar", "city"],
] as const;

const branchInfo: Record<string, { town: string; distance: number; area: "southtowns" | "city" }> = {
  "Orchard Park Public Library": { town: "Orchard Park", distance: 1, area: "southtowns" },
  "Hamburg Public Library": { town: "Hamburg", distance: 12, area: "southtowns" },
  "Lake Shore Branch Library": { town: "Lakeshore", distance: 11, area: "southtowns" },
  "Eden Library": { town: "Eden", distance: 16, area: "southtowns" },
  "Elma Public Library": { town: "Elma", distance: 10, area: "southtowns" },
  "West Seneca Public Library": { town: "West Seneca", distance: 9, area: "southtowns" },
  "Lackawanna Public Library": { town: "Lackawanna", distance: 10, area: "southtowns" },
  "Boston Free Library": { town: "Boston", distance: 17, area: "southtowns" },
  "Aurora Town Public Library": { town: "East Aurora", distance: 12, area: "southtowns" },
  "Marilla Free Library": { town: "Marilla", distance: 16, area: "southtowns" },
  "Lancaster Public Library": { town: "Lancaster", distance: 18, area: "southtowns" },
  "Anna Reinstein Memorial Library": { town: "Cheektowaga", distance: 16, area: "southtowns" },
  "Julia Boyer Reinstein Library": { town: "Cheektowaga", distance: 18, area: "southtowns" },
  "Central Library": { town: "Buffalo", distance: 18, area: "city" },
  "Crane Branch Library": { town: "Buffalo", distance: 17, area: "city" },
  "Dudley Branch Library": { town: "Buffalo", distance: 14, area: "city" },
  "East Clinton Branch Library": { town: "Buffalo", distance: 13, area: "city" },
  "Elaine M. Panty Branch Library": { town: "Buffalo", distance: 17, area: "city" },
  "Frank E. Merriweather, Jr. Branch Library": { town: "Buffalo", distance: 17, area: "city" },
  "Isaías González-Soto Branch Library": { town: "Buffalo", distance: 16, area: "city" },
  "Leroy R. Coles, Jr. Branch Library": { town: "Buffalo", distance: 18, area: "city" },
  "North Park Branch Library": { town: "Buffalo", distance: 18, area: "city" },
  "Riverside Branch Library": { town: "Buffalo", distance: 20, area: "city" },
};

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function textBetween(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() ?? "";
}

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function cleanHtml(value: string) {
  return decode(value).replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatTime(raw: string) {
  if (!raw || raw === "00:00:00") return "All day";
  const [hourText, minute] = raw.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}${minute === "00" ? "" : `:${minute}`} ${suffix}`;
}

function formatDate(key: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00Z`));
}

function dayLabel(key: string, todayKey: string) {
  if (key === todayKey) return "TODAY";
  if (key === addDays(todayKey, 1)) return "TOMORROW";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(new Date(`${key}T12:00:00Z`)).toUpperCase();
}

function mapUrl(venue: string, town: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue} ${town} NY`)}`;
}

function familyFriendly(title: string, audiences: string[], description: string) {
  const text = `${title} ${description}`.toLowerCase();
  if (/adult only|ages 21|21\+|nightclub|bar crawl|cocktail|board meeting|planning board|zoning|public hearing|fundraiser donation drop off/.test(text)) return false;
  if (audiences.length === 0) return true;
  return audiences.some((audience) => /child|teen|all ages|family|young adult/i.test(audience));
}

function parseLibrary(xml: string, todayKey: string, endKey: string): LiveEvent[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].flatMap((match, index) => {
    const item = match[1];
    const dateKey = decode(textBetween(item, "libcal:date"));
    if (dateKey < todayKey || dateKey > endKey) return [];
    const venue = cleanHtml(textBetween(item, "libcal:campus"));
    const info = branchInfo[venue];
    if (!info || info.distance > 25) return [];
    const title = cleanHtml(textBetween(item, "title"));
    const description = cleanHtml(textBetween(item, "libcal:description"));
    const audiences = [...item.matchAll(/<libcal:audience>([\s\S]*?)<\/libcal:audience>/gi)].map((value) => cleanHtml(value[1]));
    if (!familyFriendly(title, audiences, description)) return [];
    const start = decode(textBetween(item, "libcal:start"));
    const end = decode(textBetween(item, "libcal:end"));
    const registrations = decode(textBetween(item, "libcal:registrations")) === "true";
    const category = cleanHtml(textBetween(item, "category"));
    const url = decode(textBetween(item, "link"));
    const image = decode(textBetween(item, "libcal:feat_image"));
    const time = start === "00:00:00" ? "All day" : `${formatTime(start)}${end && end !== "23:59:59" ? `–${formatTime(end)}` : ""}`;
    return [{
      id: `lib-${decode(textBetween(item, "libcal:eventid")) || index}-${dateKey}`,
      area: info.area, town: info.town, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey, time,
      title, venue, distance: info.distance,
      description: description.slice(0, 220) || `${category || "Library program"} for local families.`,
      cost: `Free${registrations ? " · registration may be required" : ""}`,
      source: "Buffalo & Erie County Public Library", url, mapUrl: mapUrl(venue, info.town),
      tags: [category || "Library", ...audiences.slice(0, 2)].filter(Boolean),
      accent: ["mint", "sky", "sun", "coral", "purple"][index % 5], image: image || undefined, today: dateKey === todayKey,
    }];
  });
}

function unfoldIcs(value: string) {
  return value.replace(/\r?\n[ \t]/g, "");
}

function icsValue(block: string, name: string) {
  return block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "mi"))?.[1]?.replace(/\\n/g, " ").replace(/\\,/g, ",").trim() ?? "";
}

function icsDate(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` : "";
}

function icsTime(raw: string) {
  const digits = raw.replace(/[^0-9]/g, "");
  return digits.length >= 12 ? formatTime(`${digits.slice(8, 10)}:${digits.slice(10, 12)}:00`) : "All day";
}

function inferTown(location: string, area: "southtowns" | "city") {
  const places = ["Orchard Park", "Hamburg", "West Seneca", "Eden", "Elma", "Boston", "Blasdell", "Lackawanna", "East Aurora", "Lancaster", "South Buffalo"];
  return places.find((place) => location.toLowerCase().includes(place.toLowerCase())) ?? (area === "city" ? "Buffalo" : "Orchard Park");
}

function inferDistance(town: string) {
  return ({ "Orchard Park": 1, Hamburg: 8, "West Seneca": 9, Eden: 16, Elma: 10, Boston: 17, Blasdell: 8, Lackawanna: 10, "East Aurora": 12, Lancaster: 18, "South Buffalo": 12, Buffalo: 18 } as Record<string, number>)[town] ?? 18;
}

function parseIcs(ics: string, source: string, defaultArea: "southtowns" | "city", todayKey: string, endKey: string): LiveEvent[] {
  const unfolded = unfoldIcs(ics);
  return [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)].flatMap((match, index) => {
    const block = match[1];
    const rawStart = icsValue(block, "DTSTART");
    const dateKey = icsDate(rawStart);
    if (!dateKey || dateKey < todayKey || dateKey > endKey) return [];
    const title = icsValue(block, "SUMMARY");
    const description = cleanHtml(icsValue(block, "DESCRIPTION"));
    if (!familyFriendly(title, [], description)) return [];
    const venue = icsValue(block, "LOCATION") || source;
    const town = inferTown(venue, defaultArea);
    const distance = inferDistance(town);
    if (distance > 25) return [];
    const area = town === "Buffalo" ? "city" : defaultArea;
    const url = icsValue(block, "URL") || (source === "Town of Orchard Park" ? "https://www.orchardparkny.gov/events/" : "https://www.buffalony.gov/calendar.aspx?CID=34&view=list");
    return [{ id: `ics-${source}-${index}-${dateKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), area, town, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey, time: icsTime(rawStart), title, venue, distance, description: description.slice(0, 220) || "See the official listing for event details.", cost: "See listing", source, url, mapUrl: mapUrl(venue, town), tags: [source.includes("Orchard") ? "Orchard Park" : "Community"], accent: ["coral", "sky", "mint", "sun", "purple"][index % 5], today: dateKey === todayKey }];
  });
}

function dedupe(events: LiveEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.title.toLowerCase().replace(/[^a-z0-9]/g, "")}|${event.dateKey}|${event.venue.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET() {
  const todayKey = localDateKey();
  const endKey = addDays(todayKey, 7);
  const requests = [
    ...LIBRARY_FEEDS.map(async ([name, url]) => ({ name, kind: "library" as const, text: await fetch(url, { headers: { "user-agent": "The 25-Mile Post family event index" } }).then((response) => { if (!response.ok) throw new Error(`${response.status}`); return response.text(); }) })),
    ...ICS_FEEDS.map(async ([name, url, area]) => ({ name, kind: "ics" as const, area: area as "southtowns" | "city", text: await fetch(url, { headers: { "user-agent": "The 25-Mile Post family event index" } }).then((response) => { if (!response.ok) throw new Error(`${response.status}`); return response.text(); }) })),
  ];
  const settled = await Promise.allSettled(requests);
  const events: LiveEvent[] = [];
  const sources = settled.map((result) => {
    if (result.status === "rejected") return { name: "Source unavailable", ok: false };
    if (result.value.kind === "library") events.push(...parseLibrary(result.value.text, todayKey, endKey));
    else events.push(...parseIcs(result.value.text, result.value.name, result.value.area, todayKey, endKey));
    return { name: result.value.name, ok: true };
  });
  const normalized = dedupe(events).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.time.localeCompare(b.time) || a.distance - b.distance);
  return Response.json({ events: normalized, count: normalized.length, updatedAt: new Date().toISOString(), window: { from: todayKey, to: endKey }, sources }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" } });
}
