type EventKind = "Fairs & festivals" | "Markets & food" | "Live music" | "Sports & active" | "Outdoors" | "Museums & culture" | "Community" | "Library";

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
  kind: EventKind;
  priority: number;
};

const ZONE = "America/New_York";
const LIBRARY_FEEDS = [
  ["Library Programs", "https://buffalolib.libcal.com/rss.php?iid=4336&m=month&cid=12898"],
  ["Library Crafts", "https://buffalolib.libcal.com/rss.php?iid=4336&m=month&cid=16301"],
] as const;
const ICS_FEEDS = [
  ["Town of Orchard Park", "https://www.orchardparkny.gov/events/?ical=1", "southtowns"],
  ["Town of Evans", "https://townofevansny.gov/events/month/?ical=1&shortcode=a96c91f8", "southtowns"],
  ["West Seneca Recreation", "https://www.westseneca.gov/common/modules/iCalendar/iCalendar.aspx?catID=32&feed=calendar", "southtowns"],
  ["Hamburg Recreation", "https://www.townofhamburgny.gov/common/modules/iCalendar/iCalendar.aspx?catID=26&feed=calendar", "southtowns"],
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
  if (/adult only|ages 21|21\+|nightclub|bar crawl|cocktail|board meeting|planning board|zoning|public hearing|work session|commission meeting|committee meeting|court calendar|budget hearing|fundraiser donation drop off/.test(text)) return false;
  if (audiences.length === 0) return true;
  return audiences.some((audience) => /child|teen|all ages|family|young adult/i.test(audience));
}

function classify(title: string, description: string, source: string): EventKind {
  const text = `${title} ${description} ${source}`.toLowerCase();
  if (/fair|festival|parade|mela|art spree/.test(text)) return "Fairs & festivals";
  if (/farmers? market|farm market|food|taste|urban farm|harvest/.test(text)) return "Markets & food";
  if (/concert|live music|music series|jazz|bandstand|orchestra|symphony/.test(text)) return "Live music";
  if (/baseball|bisons|buffalo bills|football|sport|fitness|yoga|pickleball|bocce|bike/.test(text)) return "Sports & active";
  if (/park|nature|hike|outdoor|beach|garden|wildlife|soap making/.test(text)) return "Outdoors";
  if (/museum|zoo|dinosaur|shakespeare|theater|movie|tour|history|art|gallery/.test(text)) return "Museums & culture";
  if (/library|libcal|b&ecpl/.test(text)) return "Library";
  return "Community";
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
    if (/citizenship test|summer reading (program|logs?|raffle)|kids summer reading|read it & keep it|reading challenge|passive program/i.test(title)) return [];
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
      kind: "Library", priority: 1,
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
    const sourceTown = source === "Town of Evans" ? "Lakeshore" : source === "West Seneca Recreation" ? "West Seneca" : source === "Hamburg Recreation" ? "Hamburg" : "";
    const town = sourceTown || inferTown(venue, defaultArea);
    const distance = inferDistance(town);
    if (distance > 25) return [];
    const area = town === "Buffalo" ? "city" : defaultArea;
    const sourceUrl = source === "Town of Orchard Park" ? "https://www.orchardparkny.gov/events/" : source === "Town of Evans" ? "https://townofevansny.gov/events/" : source === "West Seneca Recreation" ? "https://westsenecany.myrec.com/info/calendar/list.aspx" : source === "Hamburg Recreation" ? "https://www.townofhamburgny.gov/Calendar.aspx" : "https://www.buffalony.gov/calendar.aspx?CID=34&view=list";
    const url = icsValue(block, "URL") || sourceUrl;
    const kind = classify(title, description, source);
    return [{ id: `ics-${source}-${index}-${dateKey}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), area, town, day: dayLabel(dateKey, todayKey), date: formatDate(dateKey), dateKey, time: icsTime(rawStart), title, venue, distance, description: description.slice(0, 220) || "See the official listing for event details.", cost: /\bfree\b/i.test(description) ? "Free" : "See listing", source, url, mapUrl: mapUrl(venue, town), tags: [kind, source.includes("Orchard") ? "Orchard Park" : "Community"], accent: ["coral", "sky", "mint", "sun", "purple"][index % 5], today: dateKey === todayKey, kind, priority: kind === "Community" ? 2 : 4 }];
  });
}

type FeaturedInput = Omit<LiveEvent, "day" | "date" | "today" | "mapUrl" | "accent" | "priority"> & { endDateKey?: string; priority?: number };

function featuredEvents(todayKey: string, endKey: string): LiveEvent[] {
  const items: FeaturedInput[] = [
    { id: "erie-county-fair", area: "southtowns", town: "Hamburg", dateKey: todayKey, endDateKey: "2026-08-23", time: "11 AM–10 PM · midway noon–11", title: "Erie County Fair", venue: "Hamburg Fairgrounds · 5600 McKinley Pkwy", distance: 6, description: "The Southtowns' giant annual fair packs rides, farm animals, 4-H exhibits, food, live entertainment and special daily programs into one full-day outing.", cost: "$19 adult · 12 & under free · special-day discounts", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", tags: ["Fair", "Rides", "Animals"], kind: "Fairs & festivals", priority: 10 },
    { id: "destination-dinosaur", area: "city", town: "Buffalo", dateKey: todayKey, endDateKey: "2026-08-31", time: "10 AM–5 PM · shows noon & 2", title: "Destination Dinosaur", venue: "Buffalo Zoo", distance: 17, description: "Walk among life-size animatronic dinosaurs, dig for fossils and catch two educational dino shows during a flexible zoo day.", cost: "$25.95 adult · $19.95 child", source: "Buffalo Zoo", url: "https://buffalozoo.org/series/destination-dinosaur/", tags: ["Zoo", "Dinosaurs", "All day"], kind: "Museums & culture", priority: 9 },
    { id: "hamburg-memorial-concert", area: "southtowns", town: "Hamburg", dateKey: "2026-08-12", time: "7–9 PM", title: "Summer Concert in Memorial Park", venue: "Hamburg Memorial Park", distance: 8, description: "The Village of Hamburg closes its 2026 family concert season with a free evening performance in Memorial Park.", cost: "Free", source: "Village of Hamburg", url: "https://villageofhamburgny.gov/summerconcertsinthepark", tags: ["Concert", "Family", "Outdoor"], kind: "Live music", priority: 8 },
    { id: "op-cruise-night", area: "southtowns", town: "Orchard Park", dateKey: "2026-08-12", time: "4:30–8 PM", title: "Cruise Night at the Depot", venue: "Orchard Park BR&P Depot · 370–380 S Lincoln Ave", distance: 1, description: "Classic cars gather beside the historic train depot for an easy close-to-home evening with food available to purchase.", cost: "Free admission", source: "WNY Railway Historical Society", url: "https://www.wnyrhs.org/orchard-park-depot-events", tags: ["Classic cars", "Depot", "Local"], kind: "Community", priority: 8 },
    { id: "op-stadium-run", area: "southtowns", town: "Orchard Park", dateKey: "2026-08-13", time: "6 PM", title: "Bills Stadium Run with Nike", venue: "Wayland Brewing · 3740 N Buffalo St", distance: 2, description: "Join a roughly five-mile community run from Wayland Brewing to the new Bills stadium and back.", cost: "See registration", source: "EverythingOP", url: "https://everythingop.com/event/bills-stadium-run-with-nike/", tags: ["Running", "Bills", "Local"], kind: "Sports & active", priority: 7 },
    { id: "west-seneca-market-kids", area: "southtowns", town: "West Seneca", dateKey: "2026-08-13", time: "4–7 PM", title: "West Seneca Farmers Market · Kids Day", venue: "West Seneca Town Center · 1250 Union Rd", distance: 9, description: "More than 50 local vendors, produce, baked goods, dinner options, acoustic music and extra kids activities take over the Town Center lawn.", cost: "Free entry", source: "Town of West Seneca summer flyer", url: "https://www.westseneca.gov/DocumentCenter/View/760/Summer-2026-Newsletter-FINAL?bidId=", tags: ["Farmers market", "Kids Day", "Food"], kind: "Markets & food", priority: 9 },
    { id: "hamburg-farmers-market", area: "southtowns", town: "Hamburg", dateKey: "2026-08-15", time: "7:30 AM–1 PM", title: "Hamburg Farmers Market", venue: "45 Church St · Village of Hamburg", distance: 8, description: "Shop a deep lineup of local growers and producers at this rain-or-shine Southtowns market running since 1977.", cost: "Free entry", source: "Erie Grown", url: "https://www3.erie.gov/eriegrown/eriegrown/eriegrown/growers/hamburg-farmers-market", tags: ["Farmers market", "Local food", "Rain or shine"], kind: "Markets & food", priority: 8 },
    { id: "hamburg-midweek-market", area: "southtowns", town: "Hamburg", dateKey: "2026-08-19", time: "10 AM–2 PM", title: "Mid-Week Hamburg Farmers Market", venue: "Peace Park · 22 Buffalo St", distance: 8, description: "Restock on produce, baked goods, flowers and specialty foods at a compact family-friendly midweek market in the village.", cost: "Free entry", source: "WNY Thrive · Southtowns Regional Chamber", url: "https://www.wnythrive.com/updates/mid-week-farmers-market-819", tags: ["Farmers market", "Village", "Local food"], kind: "Markets & food", priority: 8 },
    { id: "east-aurora-market-sat", area: "southtowns", town: "East Aurora", dateKey: "2026-08-15", time: "7 AM–1 PM", title: "East Aurora Farmers Market", venue: "115 Riley St · beside the Classic Rink", distance: 12, description: "Browse seasonal produce, meat, cheese, flowers, baked goods and other farm products from Western New York vendors.", cost: "Free entry", source: "Erie Grown", url: "https://www3.erie.gov/eriegrown/growers/east-aurora-farmers-market", tags: ["Farmers market", "Produce", "Local"], kind: "Markets & food", priority: 7 },
    { id: "east-aurora-market-wed", area: "southtowns", town: "East Aurora", dateKey: "2026-08-12", time: "7 AM–1 PM", title: "East Aurora Farmers Market · Wednesday", venue: "115 Riley St · beside the Classic Rink", distance: 12, description: "The midweek edition offers seasonal produce, meat, cheese, flowers, baked goods and other local farm products.", cost: "Free entry", source: "Erie Grown", url: "https://www3.erie.gov/eriegrown/growers/east-aurora-farmers-market", tags: ["Farmers market", "Produce", "Local"], kind: "Markets & food", priority: 7 },
    { id: "east-aurora-market-next-wed", area: "southtowns", town: "East Aurora", dateKey: "2026-08-19", time: "7 AM–1 PM", title: "East Aurora Farmers Market · Wednesday", venue: "115 Riley St · beside the Classic Rink", distance: 12, description: "The midweek edition offers seasonal produce, meat, cheese, flowers, baked goods and other local farm products.", cost: "Free entry", source: "Erie Grown", url: "https://www3.erie.gov/eriegrown/growers/east-aurora-farmers-market", tags: ["Farmers market", "Produce", "Local"], kind: "Markets & food", priority: 7 },
    { id: "south-buffalo-market", area: "southtowns", town: "South Buffalo", dateKey: "2026-08-16", time: "9 AM–1 PM", title: "South Buffalo Farmers Market", venue: "Cazenovia Park Casino lawn", distance: 12, description: "Local growers and makers pair with live music, free 9:30 yoga and neighborhood bike rides for a lively Sunday market.", cost: "Free entry", source: "South Buffalo Farmers Market", url: "https://southbuffalofarmersmarket.com/visit-the-market", tags: ["Farmers market", "Music", "Yoga"], kind: "Markets & food", priority: 8 },
    { id: "evangola-soap", area: "southtowns", town: "Lakeshore", dateKey: "2026-08-16", time: "See registration", title: "Soap Making at Evangola Nature Center", venue: "Evangola State Park · Irving", distance: 25, description: "Children 8 and older can make their own molded glycerin soap with a parent or guardian at the Lake Erie nature center.", cost: "Registration required · vehicle entry may be $7", source: "New York State Parks", url: "https://parks.ny.gov/visit/state-parks/evangola-state-park", tags: ["Nature center", "Craft", "Age 8+"], kind: "Outdoors", priority: 6 },
    { id: "bills-preseason", area: "southtowns", town: "Orchard Park", dateKey: "2026-08-15", time: "1 PM", title: "Buffalo Bills vs. Carolina Panthers", venue: "Highmark Stadium", distance: 3, description: "The Bills open their preseason at home, putting a major live sporting event right in Orchard Park.", cost: "Ticket prices vary", source: "Buffalo Bills", url: "https://www.buffalobills.com/schedule/", tags: ["Football", "Home game", "Tickets"], kind: "Sports & active", priority: 9 },
    { id: "op-depot-museum", area: "southtowns", town: "Orchard Park", dateKey: "2026-08-15", time: "10 AM–2 PM", title: "Orchard Park Depot Museum Open", venue: "Orchard Park BR&P Depot · 370–380 S Lincoln Ave", distance: 1, description: "Step inside Orchard Park's restored railroad depot for a close-to-home look at local transportation history.", cost: "Free admission", source: "WNY Railway Historical Society", url: "https://www.wnyrhs.org/orchard-park-depot-events", tags: ["Railroad", "Museum", "Local history"], kind: "Museums & culture", priority: 7 },
    { id: "klocs-party-12", area: "southtowns", town: "West Seneca", dateKey: "2026-08-12", time: "5–9 PM", title: "Party in the Pavilion", venue: "Kloc's Grove · 1245 Seneca Creek Rd", distance: 9, description: "A recurring Wednesday pavilion party offers live music plus food and drinks for purchase; check the listing for the week's lineup.", cost: "See listing · no outside food or drink", source: "Greater East Aurora Chamber", url: "https://business.eanycc.com/eventcalendar/Details/rock-n-kloc-s-party-in-the-pavilion-1754955", tags: ["Live music", "Food", "Pavilion"], kind: "Live music", priority: 6 },
    { id: "klocs-party-19", area: "southtowns", town: "West Seneca", dateKey: "2026-08-19", time: "5–9 PM", title: "Party in the Pavilion", venue: "Kloc's Grove · 1245 Seneca Creek Rd", distance: 9, description: "A recurring Wednesday pavilion party offers live music plus food and drinks for purchase; check the listing for the week's lineup.", cost: "See listing · no outside food or drink", source: "Greater East Aurora Chamber", url: "https://business.eanycc.com/eventcalendar/Details/rock-n-kloc-s-party-in-the-pavilion-1754955", tags: ["Live music", "Food", "Pavilion"], kind: "Live music", priority: 6 },
    { id: "fair-sensory", area: "southtowns", town: "Hamburg", dateKey: "2026-08-13", time: "11 AM–2 PM", title: "Erie County Fair · Sensory Day", venue: "Hamburg Fairgrounds", distance: 6, description: "The fair reduces flashing lights, music and loud announcements for a calmer three-hour visit before regular operations resume.", cost: "Fair admission · $19 adult · 12 & under free", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", tags: ["Sensory-friendly", "Fair", "Family"], kind: "Fairs & festivals", priority: 9 },
    { id: "fair-tractor-pull", area: "southtowns", town: "Hamburg", dateKey: "2026-08-13", time: "5:30 PM", title: "Erie County Fair · Farm & Garden Tractor Pull", venue: "Hamburg Fairgrounds", distance: 6, description: "Farm and garden tractors take over the fair's grandstand for an evening pull rooted in local agriculture.", cost: "$10 grandstand ticket · fair admission separate", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/schedule", tags: ["Tractors", "Fair", "Grandstand"], kind: "Fairs & festivals", priority: 7 },
    { id: "fair-firefighters", area: "southtowns", town: "Hamburg", dateKey: "2026-08-14", time: "11 AM–10 PM", title: "Erie County Fair · Firefighters Day", venue: "Hamburg Fairgrounds", distance: 6, description: "Qualifying firefighters receive free admission and a food voucher while families enjoy the full fair lineup.", cost: "Firefighters free with credentials · otherwise regular admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", tags: ["Fair", "Special day", "Community"], kind: "Fairs & festivals", priority: 7 },
    { id: "fair-veterans", area: "southtowns", town: "Hamburg", dateKey: "2026-08-16", time: "11 AM–10 PM", title: "Erie County Fair · Veterans & Military Day", venue: "Hamburg Fairgrounds", distance: 6, description: "Qualifying veterans and military members receive free admission and a food voucher during a full day of fair programming.", cost: "Veterans/military free with voucher rules · otherwise regular admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", tags: ["Fair", "Military", "Special day"], kind: "Fairs & festivals", priority: 7 },
    { id: "fair-seniors", area: "southtowns", town: "Hamburg", dateKey: "2026-08-18", time: "11 AM–10 PM", title: "Erie County Fair · Senior Discount Day", venue: "Hamburg Fairgrounds", distance: 6, description: "Visitors age 62 and older receive discounted gate admission while the regular fair program continues all day.", cost: "$12 age 62+ · otherwise regular admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", tags: ["Fair", "Senior discount", "Special day"], kind: "Fairs & festivals", priority: 6 },
    { id: "fair-double-fun", area: "southtowns", town: "Hamburg", dateKey: "2026-08-19", time: "11 AM–10 PM", title: "Erie County Fair · Double Fun Day", venue: "Hamburg Fairgrounds", distance: 6, description: "Two adult admissions are bundled for a lower gate price, making a midweek fair visit easier for families and pairs.", cost: "Two adult admissions $30", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", tags: ["Fair", "Discount", "Special day"], kind: "Fairs & festivals", priority: 6 },
    { id: "fair-hunter-13", area: "southtowns", town: "Hamburg", dateKey: "2026-08-13", time: "See schedule", title: "Erie County Fair · Hunter Jumper Show", venue: "Horse Show Complex · Hamburg Fairgrounds", distance: 6, description: "Watch horses and riders compete in the fair's Hunter Jumper Show during a full day at the grounds.", cost: "Included with fair admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/competitions/horse-shows", tags: ["Horses", "Fair", "Competition"], kind: "Fairs & festivals", priority: 7 },
    { id: "fair-hunter-14", area: "southtowns", town: "Hamburg", dateKey: "2026-08-14", time: "See schedule", title: "Erie County Fair · Hunter Jumper Show", venue: "Horse Show Complex · Hamburg Fairgrounds", distance: 6, description: "Watch horses and riders compete in the fair's Hunter Jumper Show during a full day at the grounds.", cost: "Included with fair admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/competitions/horse-shows", tags: ["Horses", "Fair", "Competition"], kind: "Fairs & festivals", priority: 7 },
    { id: "fair-hunter-15", area: "southtowns", town: "Hamburg", dateKey: "2026-08-15", time: "See schedule", title: "Erie County Fair · Hunter Jumper Show", venue: "Horse Show Complex · Hamburg Fairgrounds", distance: 6, description: "Watch horses and riders compete in the fair's Hunter Jumper Show during a full day at the grounds.", cost: "Included with fair admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/competitions/horse-shows", tags: ["Horses", "Fair", "Competition"], kind: "Fairs & festivals", priority: 7 },
    { id: "fair-horse-pulls", area: "southtowns", town: "Hamburg", dateKey: "2026-08-16", time: "Heavy noon · light 4 PM", title: "Erie County Fair · Horse Pulls", venue: "Horse Show Complex · Hamburg Fairgrounds", distance: 6, description: "See powerful draft teams compete in heavy and light horse pulls as part of the fair's agricultural program.", cost: "Included with fair admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/competitions/horse-shows", tags: ["Horses", "Fair", "Agriculture"], kind: "Fairs & festivals", priority: 8 },
    { id: "fair-4h-17", area: "southtowns", town: "Hamburg", dateKey: "2026-08-17", time: "See schedule", title: "Erie County Fair · 4-H Horse Show", venue: "Horse Show Complex · Hamburg Fairgrounds", distance: 6, description: "Cheer on young local riders and learn about 4-H horsemanship during the fair's youth horse show.", cost: "Included with fair admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/competitions/horse-shows", tags: ["4-H", "Horses", "Fair"], kind: "Fairs & festivals", priority: 7 },
    { id: "fair-4h-18", area: "southtowns", town: "Hamburg", dateKey: "2026-08-18", time: "See schedule", title: "Erie County Fair · 4-H Horse Show", venue: "Horse Show Complex · Hamburg Fairgrounds", distance: 6, description: "Cheer on young local riders and learn about 4-H horsemanship during the fair's youth horse show.", cost: "Included with fair admission", source: "Erie County Fair", url: "https://www.ecfair.org/p/competitions/horse-shows", tags: ["4-H", "Horses", "Fair"], kind: "Fairs & festivals", priority: 7 },
    { id: "op-farmers-market", area: "southtowns", town: "Orchard Park", dateKey: "2026-08-17", time: "4–7 PM", title: "Village of Orchard Park Farmers Market", venue: "Historic Orchard Park Train Depot · 395 S Lincoln Ave", distance: 1, description: "Local produce and community vendors gather at the depot for Orchard Park's convenient Monday evening market.", cost: "Free entry", source: "EverythingOP", url: "https://everythingop.com/series/village-of-orchard-park-farmers-market/", tags: ["Farmers market", "Local", "Depot"], kind: "Markets & food", priority: 9 },
    { id: "canalside-kids", area: "city", town: "Buffalo", dateKey: "2026-08-14", time: "10:30 AM", title: "Canalside for Kids Walking Tour", venue: "Waterway of Change Museum · Longshed", distance: 19, description: "A guide turns waterfront history into a one-mile, stroller-friendly adventure designed for children ages 5–10.", cost: "Free · registration required", source: "Explore Buffalo", url: "https://explorebuffalo.org/waterfront/canalside-for-kids/", tags: ["Tour", "History", "Kids"], kind: "Museums & culture", priority: 7 },
    { id: "epic-storytime-12", area: "city", town: "Buffalo", dateKey: "2026-08-12", time: "10:30 AM–12:30 PM", title: "EPIC Storytime at Canalside", venue: "Canalside Great Lawn", distance: 19, description: "Stories and extended literacy activities help children ages 0–8 and caregivers learn and play together outdoors.", cost: "Free · registration required", source: "Buffalo Waterfront", url: "https://buffalowaterfront.com/events/epic-childrens-programming", tags: ["Storytime", "Literacy", "Waterfront"], kind: "Outdoors", priority: 7 },
    { id: "epic-storytime-19", area: "city", town: "Buffalo", dateKey: "2026-08-19", time: "10:30 AM–12:30 PM", title: "EPIC Storytime at Canalside", venue: "Canalside Great Lawn", distance: 19, description: "Stories and extended literacy activities help children ages 0–8 and caregivers learn and play together outdoors.", cost: "Free · registration required", source: "Buffalo Waterfront", url: "https://buffalowaterfront.com/events/epic-childrens-programming", tags: ["Storytime", "Literacy", "Waterfront"], kind: "Outdoors", priority: 7 },
    { id: "free-play-friday", area: "city", town: "Buffalo", dateKey: "2026-08-14", time: "11 AM–1 PM", title: "Free Play Friday with Explore & More", venue: "Canalside · Pierce Lawn", distance: 19, description: "Explore & More brings free outdoor children's play, sports and hands-on activities to the waterfront.", cost: "Free", source: "Buffalo Waterfront", url: "https://buffalowaterfront.com/events/free-play-fridays-with-explore-more", tags: ["Play", "Kids", "Waterfront"], kind: "Outdoors", priority: 7 },
    { id: "wild-robot", area: "city", town: "Buffalo", dateKey: "2026-08-14", time: "7–10 PM · film at sunset", title: "Family Movie Night: The Wild Robot", venue: "Prospect Park · Connecticut & Niagara", distance: 17, description: "Bring a blanket or chair for the animated family adventure under the stars, with light refreshments while supplies last.", cost: "Free", source: "Buffalo Olmsted Parks", url: "https://www.bfloparks.org/event/movie-nights/2026-08-14/", tags: ["Movie", "Outdoor", "Family"], kind: "Museums & culture", priority: 8 },
    { id: "festival-india", area: "city", town: "Buffalo", dateKey: "2026-08-15", time: "2–8 PM", title: "Festival of India", venue: "Canalside", distance: 19, description: "Indian dance, music, food, art and community fill the waterfront at this welcoming all-ages cultural festival.", cost: "Free", source: "Buffalo Waterfront", url: "https://buffalowaterfront.com/events/festivalofindia", tags: ["Festival", "Food", "Music"], kind: "Fairs & festivals", priority: 9 },
    { id: "urban-farm-day", area: "city", town: "Buffalo", dateKey: "2026-08-15", time: "10 AM–3 PM", title: "Urban Farm Day", venue: "20+ Buffalo urban farms", distance: 18, description: "Build a self-guided route through urban farms for tours, workshops, animals, gardens and an all-ages scavenger hunt.", cost: "Free · no tickets", source: "Gardens Buffalo Niagara", url: "https://www.gardensbuffaloniagara.com/urban-farm-day-tour", tags: ["Farms", "Tours", "Rain or shine"], kind: "Markets & food", priority: 8 },
    { id: "carnegie-art-spree-15", area: "city", town: "Buffalo", dateKey: "2026-08-15", time: "11 AM–5 PM", title: "Carnegie Art Spree Festival", venue: "Canal Street · City of Tonawanda", distance: 25, description: "A free Erie Canal arts festival mixes juried artists, light live music, food trucks and a family scavenger hunt.", cost: "Free admission & nearby parking", source: "Carnegie Art Center", url: "https://www.carnegieartspree.org/about", tags: ["Art festival", "Music", "Food trucks"], kind: "Fairs & festivals", priority: 6 },
    { id: "carnegie-art-spree-16", area: "city", town: "Buffalo", dateKey: "2026-08-16", time: "11 AM–5 PM", title: "Carnegie Art Spree Festival", venue: "Canal Street · City of Tonawanda", distance: 25, description: "A free Erie Canal arts festival mixes juried artists, light live music, food trucks and a family scavenger hunt.", cost: "Free admission & nearby parking", source: "Carnegie Art Center", url: "https://www.carnegieartspree.org/about", tags: ["Art festival", "Music", "Food trucks"], kind: "Fairs & festivals", priority: 6 },
    { id: "bisons-superhero", area: "city", town: "Buffalo", dateKey: "2026-08-16", time: "6:35 PM first pitch", title: "Bisons Super Hero Night", venue: "Sahlen Field", distance: 19, description: "A family baseball night adds Marvel costume photos, a comic giveaway for early arrivals and postgame fireworks.", cost: "$22 single · $99 family pack", source: "Buffalo Bisons", url: "https://www.milb.com/buffalo/events/marvel", tags: ["Baseball", "Super heroes", "Fireworks"], kind: "Sports & active", priority: 9 },
    { id: "levitt-la-krema", area: "city", town: "Buffalo", dateKey: "2026-08-17", time: "5–8 PM · music 5:30", title: "Levitt VIBE Buffalo · La Krema", venue: "Ralph C. Wilson Jr. Centennial Park", distance: 17, description: "Bring chairs or a picnic for a free lawn concert near the splash pad, with food trucks and community vendors.", cost: "Free", source: "Ralph Wilson Park", url: "https://rwparkbuffalo.org/levitt/", tags: ["Concert", "Picnic", "Splash pad"], kind: "Live music", priority: 8 },
    { id: "au-some-morning", area: "city", town: "Buffalo", dateKey: "2026-08-18", time: "9:30–11:30 AM", title: "Au-Some Morning Edition", venue: "Explore & More Children's Museum", distance: 19, description: "A sensory-friendly museum morning welcomes autistic children, friends and families for calm play, art and tinkering.", cost: "Free · registration required", source: "Explore & More", url: "https://exploreandmore.org/education/au-some-evenings/", tags: ["Sensory-friendly", "Museum", "Kids"], kind: "Museums & culture", priority: 8 },
    { id: "rock-the-block", area: "city", town: "Buffalo", dateKey: "2026-08-19", time: "5–8 PM", title: "Rock the Block", venue: "161 Vermont St · West Side", distance: 18, description: "A family block party combines food trucks, a foam party, arts and crafts, a DJ, inflatables and street hockey.", cost: "No admission price listed", source: "City of Buffalo", url: "https://www.buffalony.gov/Calendar.aspx?EID=6375", tags: ["Block party", "Food trucks", "Kids"], kind: "Community", priority: 8 },
  ];
  return items.flatMap((item, index) => {
    const activeEnd = item.endDateKey ?? item.dateKey;
    if (activeEnd < todayKey || item.dateKey > endKey) return [];
    const dateKey = item.dateKey < todayKey ? todayKey : item.dateKey;
    const date = item.endDateKey ? `${formatDate(dateKey)}–${formatDate(item.endDateKey)}` : formatDate(dateKey);
    return [{ ...item, dateKey, date, day: dayLabel(dateKey, todayKey), today: dateKey === todayKey, mapUrl: mapUrl(item.venue, item.town), accent: ["coral", "sun", "mint", "sky", "purple"][index % 5], priority: item.priority ?? 6 }];
  });
}

function capLibraries(events: LiveEvent[]) {
  const library = events.filter((event) => event.kind === "Library").sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.distance - b.distance);
  const nonLibrary = events.filter((event) => event.kind !== "Library");
  const byVenue = new Map<string, number>();
  const byDayArea = new Map<string, number>();
  const selected = library.filter((event) => {
    const venueCount = byVenue.get(event.venue) ?? 0;
    const dayAreaKey = `${event.dateKey}|${event.area}`;
    const dayAreaCount = byDayArea.get(dayAreaKey) ?? 0;
    if (venueCount >= 2 || dayAreaCount >= 2) return false;
    byVenue.set(event.venue, venueCount + 1);
    byDayArea.set(dayAreaKey, dayAreaCount + 1);
    return true;
  }).slice(0, 20);
  return [...nonLibrary, ...selected];
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
  const normalized = capLibraries(dedupe([...featuredEvents(todayKey, endKey), ...events])).sort((a, b) => a.dateKey.localeCompare(b.dateKey) || b.priority - a.priority || a.distance - b.distance || a.time.localeCompare(b.time));
  const mix = Object.fromEntries([...new Set(normalized.map((event) => event.kind))].map((kind) => [kind, normalized.filter((event) => event.kind === kind).length]));
  return Response.json({ events: normalized, count: normalized.length, updatedAt: new Date().toISOString(), window: { from: todayKey, to: endKey }, sources, mix }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } });
}
