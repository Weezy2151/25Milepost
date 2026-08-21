"use client";

import { useEffect, useState } from "react";

type Area = "southtowns" | "city";
type View = "southtowns" | "city" | "all";
type EventKind = "All activities" | "Fairs & festivals" | "Markets & food" | "Live music" | "Sports & active" | "Outdoors" | "Museums & culture" | "Community" | "Library";
type SettingFilter = "all" | "indoor" | "outdoor";

type EventPick = {
  id: string;
  area: Area;
  town: string;
  day: string;
  date: string;
  dateKey?: string;
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
  kind?: Exclude<EventKind, "All activities">;
  setting?: "indoor" | "outdoor" | "both";
  priority?: number;
};

const legacyFallbackEvents: EventPick[] = [
  { id: "erie-fair", area: "southtowns", town: "Hamburg", day: "TODAY", date: "Wed, Aug 12", time: "11 AM–10 PM · midway noon–11", title: "Erie County Fair · Opening Day", venue: "Hamburg Fairgrounds", distance: 6, description: "Rides, farm animals, 4-H exhibits, food and opening-day community spirit make this the Southtowns’ biggest family outing.", cost: "Free with 4+ canned goods · otherwise $19 adult", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Fairgrounds+5600+McKinley+Parkway+Hamburg+NY", tags: ["Fair", "Kids", "Food"], accent: "coral", image: "/events/erie-county-fair.jpg", today: true, setting: "both" },
  { id: "op-reptiles", area: "southtowns", town: "Orchard Park", day: "TODAY", date: "Wed, Aug 12", time: "2 PM", title: "Reptiles Around the World", venue: "Orchard Park Public Library", distance: 1, description: "Repco Wildlife Encounters brings live reptiles to the library for a close-to-home, all-ages animal program.", cost: "Free · registration required", source: "B&ECPL", url: "https://www.buffalolib.org/orchard-park-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY", tags: ["Animals", "Kids", "Indoor"], accent: "mint", today: true, setting: "indoor" },
  { id: "elma-fossils", area: "southtowns", town: "Elma", day: "TODAY", date: "Wed, Aug 12", time: "2–3 PM", title: "Fossil Frenzy Play Cafe", venue: "Elma Public Library", distance: 10, description: "Handle fossils and explore a digital microscope in a hands-on, all-ages library play session.", cost: "Free · no registration", source: "B&ECPL", url: "https://www.buffalolib.org/locations-hours/elma-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Elma+Public+Library+Elma+NY", tags: ["Science", "Kids", "Drop-in"], accent: "sky", today: true, setting: "indoor" },
  { id: "hamburg-storytime", area: "southtowns", town: "Hamburg", day: "TODAY", date: "Wed, Aug 12", time: "10:30 or 11:30 AM", title: "Hamburg Public Library Story Time", venue: "Hamburg Public Library", distance: 12, description: "Themed stories, crafts and movement for young children and caregivers in a welcoming indoor setting.", cost: "Free · registration required", source: "B&ECPL", url: "https://www.buffalolib.org/locations-hours/hamburg-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Public+Library+102+Buffalo+Street+Hamburg+NY", tags: ["Storytime", "Kids", "Indoor"], accent: "sun", today: true, setting: "indoor" },
  { id: "destination-dinosaur", area: "city", town: "Buffalo", day: "TODAY", date: "Wed, Aug 12", time: "10 AM–5 PM", title: "Destination Dinosaur", venue: "Buffalo Zoo", distance: 17, description: "Walk a trail of life-size animatronic dinosaurs, dig for fossils and catch educational dino shows at noon and 2 PM.", cost: "$25.95 adult · $19.95 child", source: "Buffalo Zoo", url: "https://buffalozoo.org/event/destination-dinosaur/2026-08-12/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Buffalo+Zoo+300+Parkside+Avenue+Buffalo+NY", tags: ["Animals", "Dinosaurs", "All day"], accent: "purple", today: true, setting: "both" },
  { id: "lake-shore-storytime", area: "southtowns", town: "Lakeshore", day: "THU", date: "Thu, Aug 13", time: "10 AM", title: "StoryTime Shookup", venue: "Lake Shore Branch Library · Hamburg", distance: 9, description: "Silly stories, music, movement and a craft make this a breezy morning for preschoolers and caregivers.", cost: "Free · no registration", source: "B&ECPL", url: "https://www.buffalolib.org/locations-hours/lake-shore-branch-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Lake+Shore+Branch+Library+4857+Lake+Shore+Road+Hamburg+NY", tags: ["Storytime", "Music", "Kids"], accent: "mint", setting: "indoor" },
  { id: "boston-bubbles", area: "southtowns", town: "Boston", day: "THU", date: "Thu, Aug 13", time: "4:30–6:30 PM", title: "Annual Bubble Day", venue: "Boston Free Library", distance: 17, description: "Test giant bubbles, experiment with wands and make a soapy science memory together.", cost: "Free · registration required", source: "B&ECPL", url: "https://www.buffalolib.org/locations-hours/boston-free-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Boston+Free+Library+9475+Boston+State+Road+Boston+NY", tags: ["Science", "All ages", "Outdoor"], accent: "sky", setting: "outdoor" },
  { id: "hamburg-games", area: "southtowns", town: "Hamburg", day: "THU", date: "Thu, Aug 13", time: "5–7 PM", title: "Family Game Night", venue: "Hamburg Public Library", distance: 12, description: "Board games and low-key family competition make an easy after-dinner outing close to home.", cost: "Free library program", source: "B&ECPL", url: "https://www.buffalolib.org/locations-hours/hamburg-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Public+Library+102+Buffalo+Street+Hamburg+NY", tags: ["Games", "Kids", "Indoor"], accent: "coral", setting: "indoor" },
  { id: "dinosaur-escape", area: "southtowns", town: "Orchard Park", day: "ALL WEEK", date: "Sat, Aug 8–Sat, Aug 22", time: "During library hours", title: "Dinosaur Escape!", venue: "Orchard Park Public Library", distance: 1, description: "Solve a 45-minute dinosaur-themed escape room with your family without leaving Orchard Park.", cost: "Free · registration required", source: "B&ECPL", url: "https://www.buffalolib.org/orchard-park-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY", tags: ["Puzzle", "Dinosaurs", "Indoor"], accent: "purple", setting: "indoor" },
  { id: "south-buffalo-market", area: "southtowns", town: "South Buffalo", day: "SUN", date: "Sun, Aug 16", time: "9 AM–1 PM", title: "South Buffalo Farmers Market", venue: "Cazenovia Park Casino lawn", distance: 12, description: "Local growers and makers, live music, free yoga and neighborhood bike rides make Sunday morning feel neighborly.", cost: "Free entry", source: "South Buffalo Farmers Market", url: "https://southbuffalofarmersmarket.com/visit-the-market", mapUrl: "https://www.google.com/maps/search/?api=1&query=Cazenovia+Park+Casino+Buffalo+NY", tags: ["Market", "Food", "Music"], accent: "sun", setting: "outdoor" },
  { id: "op-dog", area: "southtowns", town: "Orchard Park", day: "WED", date: "Wed, Aug 19", time: "4–5 PM", title: "Read to a Dog", venue: "Orchard Park Public Library", distance: 1, description: "Children can practice reading with a certified therapy dog in a relaxed, confidence-building library visit.", cost: "Free · drop-in", source: "B&ECPL", url: "https://www.buffalolib.org/locations-hours/orchard-park-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY", tags: ["Animals", "Reading", "Kids"], accent: "mint", setting: "indoor" },
  { id: "eden-books", area: "southtowns", town: "Eden", day: "TUE", date: "Tue, Aug 18", time: "4 PM", title: "Chapter Books, Cookies & Coloring", venue: "Eden Library", distance: 16, description: "A relaxed reading-and-craft hour pairs chapter-book conversation with cookies and coloring for young readers.", cost: "Free library program", source: "B&ECPL", url: "https://www.buffalolib.org/eden-library-calendar", mapUrl: "https://www.google.com/maps/search/?api=1&query=Eden+Library+2901+East+Church+Street+Eden+NY", tags: ["Reading", "Crafts", "Kids"], accent: "sun", setting: "indoor" },
  { id: "shakespeare", area: "city", town: "Buffalo", day: "THU–SUN", date: "Thu, Aug 13–Sun, Aug 16", time: "7 PM", title: "The Taming of the Shrew", venue: "Shakespeare Hill · Delaware Park", distance: 16, description: "Pack a picnic for Buffalo’s beloved free Shakespeare tradition under the trees beside Hoyt Lake.", cost: "Free · non-ticketed", source: "Shakespeare in Delaware Park", url: "https://shakespeareindelawarepark.org/mainstage/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Shakespeare+Hill+Delaware+Park+Buffalo+NY", tags: ["Theater", "Outdoor", "Picnic"], accent: "coral", setting: "outdoor" },
  { id: "canalside-kids", area: "city", town: "Buffalo", day: "FRI", date: "Fri, Aug 14", time: "10:30 AM", title: "Canalside for Kids Walking Tour", venue: "Waterway of Change Museum", distance: 19, description: "A guide turns the waterfront’s history into a one-mile, stroller-friendly adventure designed especially for ages 5–10.", cost: "Free · registration required", source: "Explore Buffalo", url: "https://explorebuffalo.org/waterfront/canalside-for-kids/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Longshed+Building+Canalside+Buffalo+NY", tags: ["History", "Kids", "Outdoor"], accent: "sky", setting: "outdoor" },
  { id: "wild-robot", area: "city", town: "Buffalo", day: "FRI", date: "Fri, Aug 14", time: "7–10 PM · film at sunset", title: "Family Movie Night: The Wild Robot", venue: "Prospect Park", distance: 17, description: "Bring blankets and chairs for a free outdoor showing of the tender animated adventure.", cost: "Free", source: "Buffalo Olmsted Parks", url: "https://www.bfloparks.org/event/movie-nights/2026-08-14/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Prospect+Park+Connecticut+Street+Buffalo+NY", tags: ["Movie", "Kids", "Outdoor"], accent: "purple", setting: "outdoor" },
  { id: "festival-india", area: "city", town: "Buffalo", day: "SAT", date: "Sat, Aug 15", time: "2–8 PM", title: "Festival of India", venue: "Canalside", distance: 19, description: "A waterfront celebration of Indian dance, music, food, art and community designed to welcome every age.", cost: "Free", source: "Buffalo Waterfront", url: "https://buffalowaterfront.com/events/festivalofindia", mapUrl: "https://www.google.com/maps/search/?api=1&query=Canalside+44+Prime+Street+Buffalo+NY", tags: ["Festival", "Food", "Music"], accent: "coral", image: "/events/festival-of-india.jpg", setting: "outdoor" },
  { id: "bisons", area: "city", town: "Buffalo", day: "SUN", date: "Sun, Aug 16", time: "6:35 PM first pitch", title: "Bisons Super Hero Night", venue: "Sahlen Field", distance: 19, description: "A family baseball night with Marvel comic giveaways, costume photos and postgame fireworks.", cost: "$22 single · $99 family pack", source: "Buffalo Bisons", url: "https://www.milb.com/buffalo/events/marvel", mapUrl: "https://www.google.com/maps/search/?api=1&query=Sahlen+Field+1+James+D+Griffin+Plaza+Buffalo+NY", tags: ["Baseball", "Kids", "Fireworks"], accent: "sun", setting: "outdoor" },
  { id: "au-some", area: "city", town: "Buffalo", day: "TUE", date: "Tue, Aug 18", time: "9:30–11:30 AM", title: "Au-Some Morning Edition", venue: "Explore & More Children’s Museum", distance: 19, description: "A sensory-friendly museum morning welcomes autistic children, friends and families for calm play, art and tinkering.", cost: "Free · registration required", source: "Explore & More", url: "https://exploreandmore.org/education/au-some-evenings/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Explore+and+More+130+Main+Street+Buffalo+NY", tags: ["Sensory-friendly", "Museum", "Kids"], accent: "mint", setting: "indoor" },
];

const fallbackEvents: EventPick[] = [
  legacyFallbackEvents[0],
  { id: "op-cruise", area: "southtowns", town: "Orchard Park", day: "TODAY", date: "Wed, Aug 12", time: "4:30–8 PM", title: "Cruise Night at the Depot", venue: "Orchard Park BR&P Depot", distance: 1, description: "Classic cars gather at the historic train depot for a close-to-home evening with food available.", cost: "Free admission", source: "WNY Railway Historical Society", url: "https://www.wnyrhs.org/orchard-park-depot-events", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+BRP+Depot", tags: ["Classic cars", "Depot", "Local"], accent: "mint", today: true, kind: "Community", setting: "both" },
  { id: "hamburg-concert", area: "southtowns", town: "Hamburg", day: "TODAY", date: "Wed, Aug 12", time: "7–9 PM", title: "Summer Concert in Memorial Park", venue: "Hamburg Memorial Park", distance: 8, description: "The Village of Hamburg closes its free, family-friendly summer concert season in the park.", cost: "Free", source: "Village of Hamburg", url: "https://villageofhamburgny.gov/summerconcertsinthepark", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Memorial+Park", tags: ["Concert", "Family", "Outdoor"], accent: "sky", today: true, kind: "Live music", setting: "outdoor" },
  { id: "ea-market", area: "southtowns", town: "East Aurora", day: "TODAY", date: "Wed, Aug 12", time: "7 AM–1 PM", title: "East Aurora Farmers Market", venue: "115 Riley St · Classic Rink", distance: 12, description: "Browse produce, meat, cheese, flowers, baked goods and other local farm products.", cost: "Free entry", source: "Erie Grown", url: "https://www3.erie.gov/eriegrown/growers/east-aurora-farmers-market", mapUrl: "https://www.google.com/maps/search/?api=1&query=115+Riley+Street+East+Aurora+NY", tags: ["Farmers market", "Produce", "Local"], accent: "sun", today: true, kind: "Markets & food", setting: "outdoor" },
  { id: "west-seneca-market", area: "southtowns", town: "West Seneca", day: "THU", date: "Thu, Aug 13", time: "4–7 PM", title: "West Seneca Farmers Market · Kids Day", venue: "West Seneca Town Center", distance: 9, description: "More than 50 local vendors, dinner options, acoustic music and extra kids activities fill the Town Center lawn.", cost: "Free entry", source: "Town of West Seneca", url: "https://www.westseneca.gov/DocumentCenter/View/760/Summer-2026-Newsletter-FINAL?bidId=", mapUrl: "https://www.google.com/maps/search/?api=1&query=West+Seneca+Town+Center", tags: ["Farmers market", "Kids Day", "Food"], accent: "purple", kind: "Markets & food", setting: "outdoor" },
  { id: "bills", area: "southtowns", town: "Orchard Park", day: "SAT", date: "Sat, Aug 15", time: "1 PM", title: "Buffalo Bills vs. Carolina Panthers", venue: "Highmark Stadium", distance: 3, description: "The Bills open their preseason at home, putting a major sporting event right in Orchard Park.", cost: "Ticket prices vary", source: "Buffalo Bills", url: "https://www.buffalobills.com/schedule/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Highmark+Stadium+Orchard+Park+NY", tags: ["Football", "Home game", "Tickets"], accent: "coral", kind: "Sports & active", setting: "outdoor" },
  { id: "hamburg-market", area: "southtowns", town: "Hamburg", day: "SAT", date: "Sat, Aug 15", time: "7:30 AM–1 PM", title: "Hamburg Farmers Market", venue: "45 Church St", distance: 8, description: "Shop a deep lineup of local growers and producers at this rain-or-shine Southtowns market.", cost: "Free entry", source: "Erie Grown", url: "https://www3.erie.gov/eriegrown/eriegrown/eriegrown/growers/hamburg-farmers-market", mapUrl: "https://www.google.com/maps/search/?api=1&query=45+Church+Street+Hamburg+NY", tags: ["Farmers market", "Local food", "Rain or shine"], accent: "mint", kind: "Markets & food", setting: "outdoor" },
  { id: "op-market", area: "southtowns", town: "Orchard Park", day: "MON", date: "Mon, Aug 17", time: "4–7 PM", title: "Village of Orchard Park Farmers Market", venue: "Historic Orchard Park Train Depot", distance: 1, description: "Local produce and community vendors gather at the depot for a convenient Monday evening market.", cost: "Free entry", source: "WNY Railway Historical Society", url: "https://www.wnyrhs.org/orchard-park-depot-events", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Train+Depot", tags: ["Farmers market", "Local", "Depot"], accent: "sun", kind: "Markets & food", setting: "outdoor" },
];

const preferredTowns = ["Orchard Park", "Hamburg", "Lakeshore", "West Seneca", "Eden", "Elma", "Boston", "South Buffalo"];

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Misty";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain possible";
  if (code <= 77) return "Wintry";
  if (code >= 95) return "Storms possible";
  return "Changeable skies";
}

function EventCard({ event, saved, onToggle }: { event: EventPick; saved: string[]; onToggle: (id: string) => void }) {
  const settingBadge = event.setting === "indoor" ? "🏛️ Indoor" : event.setting === "outdoor" ? "🌳 Outdoor" : "🏛️🌳 Both";

  return (
    <article className={`event-card accent-${event.accent}`} id={event.id}>
      {event.image ? (
        <div className="event-card-image"><img src={event.image} alt={event.title} /></div>
      ) : (
        <div className="event-card-pattern" aria-hidden="true">
          <span>{event.tags[0]}</span>
          <b>{event.town === "Orchard Park" ? "OP" : event.town.slice(0, 2).toUpperCase()}</b>
        </div>
      )}
      <div className="event-card-body">
        <div className="event-card-top">
          <span className="day-badge">{event.day}</span>
          <div className="badges-group">
            <span className="setting-badge" title={`Setting: ${event.setting || "mixed"}`}>{settingBadge}</span>
            <span className="distance-badge">{event.distance} mi away</span>
          </div>
        </div>
        <p className="event-date">{event.date} <span>·</span> {event.time}</p>
        <h3>{event.title}</h3>
        <p className="event-location">{event.venue} · {event.town}</p>
        <p className="event-description">{event.description}</p>
        <div className="tag-row">{event.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className="event-card-bottom">
          <div>
            <strong>{event.cost}</strong>
            <small>Source: {event.source}</small>
          </div>
          <button
            onClick={() => onToggle(event.id)}
            className={saved.includes(event.id) ? "save-card saved" : "save-card"}
            aria-label={`${saved.includes(event.id) ? "Remove" : "Save"} ${event.title}`}
          >
            {saved.includes(event.id) ? "Saved" : "Save"}
          </button>
        </div>
        <div className="event-links">
          <a href={event.url} target="_blank" rel="noreferrer">View listing ↗</a>
          <a href={event.mapUrl} target="_blank" rel="noreferrer">Map</a>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [events, setEvents] = useState<EventPick[]>(fallbackEvents);
  const [view, setView] = useState<View>("southtowns");
  const [kind, setKind] = useState<EventKind>("All activities");
  const [setting, setSetting] = useState<SettingFilter>("all");
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [town, setTown] = useState("All towns");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("twenty-five-mile-post-clippings");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showSaved, setShowSaved] = useState(false);
  const [weather, setWeather] = useState("Checking the Orchard Park sky…");
  const [rainChance, setRainChance] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [refreshing, setRefreshing] = useState(true);

  const refreshEvents = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/events?edition=balanced-v2");
      if (!response.ok) throw new Error("refresh failed");
      const data = await response.json();
      if (Array.isArray(data.events) && data.events.length) {
        setEvents(data.events);
        setUpdatedAt(data.updatedAt);
      }
    } catch {
      setNotice("A source refresh failed; showing the last verified snapshot.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshEvents(), 0);
    fetch("https://api.open-meteo.com/v1/forecast?latitude=42.767&longitude=-78.744&current=temperature_2m,weather_code&daily=temperature_2m_max,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FNew_York")
      .then((response) => response.json())
      .then((data) => {
        const prob = data?.daily?.precipitation_probability_max?.[0] ?? 0;
        setRainChance(prob);
        setWeather(`${weatherLabel(data.current.weather_code)} · ${Math.round(data.current.temperature_2m)}° now · ${Math.round(data.daily.temperature_2m_max[0])}° high · ${prob}% rain`);
      })
      .catch(() => setWeather("Forecast unavailable · check before outdoor plans"));
    return () => { window.clearTimeout(initialRefresh); };
  }, []);

  const matches = (event: EventPick) => {
    const inView = view === "all" || event.area === view;
    const inTown = town === "All towns" || event.town === town || (town === "Lakeshore" && event.town.includes("Lakeshore"));
    const inKind = kind === "All activities" || event.kind === kind || (!event.kind && event.tags.some((tag) => tag === kind));
    const inSetting = setting === "all" || event.setting === setting || event.setting === "both" || !event.setting;
    const inDistance = maxDistance === null || event.distance <= maxDistance;
    const text = `${event.title} ${event.description} ${event.venue} ${event.town} ${event.tags.join(" ")}`.toLowerCase();
    return inView && inTown && inKind && inSetting && inDistance && (!query || text.includes(query.toLowerCase())) && (!showSaved || saved.includes(event.id));
  };

  const today = events.filter((event) => event.today && matches(event));
  const upcoming = events.filter((event) => !event.today && matches(event));
  const townFilters = ["All towns", ...Array.from(new Set([...preferredTowns, ...events.map((event) => event.town)]))];
  const kindFilters: EventKind[] = ["All activities", "Fairs & festivals", "Markets & food", "Live music", "Sports & active", "Outdoors", "Museums & culture", "Community", "Library"];
  const nonLibraryCount = events.filter((event) => event.kind !== "Library").length;
  const isRainLikely = rainChance !== null && rainChance >= 40;

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    window.localStorage.setItem("twenty-five-mile-post-clippings", JSON.stringify(next));
    setNotice(saved.includes(id) ? "Removed from saved plans." : "Saved for later on this device.");
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
      setNotice("Sharing cancelled.");
    }
  };

  return (
    <main>
      <div className="site-shell">
        <header className="app-header">
          <div className="header-top">
            <span>ORCHARD PARK · SOUTHTOWNS · WESTERN NEW YORK</span>
            <span>{refreshing ? "Loading this morning’s edition…" : `${events.length} events · ${nonLibraryCount} beyond libraries · refreshed each morning`}</span>
            <button onClick={share}>Share ↗</button>
          </div>
          <div className="header-main">
            <div>
              <p className="eyebrow">Things to do near Orchard Park</p>
              <h1>The 25-Mile Post</h1>
            </div>
            <div className="weather-card">
              <span>Live Orchard Park weather</span>
              <strong>{weather}</strong>
              <small>{updatedAt ? `Events refreshed ${new Date(updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading live events…"}</small>
            </div>
          </div>
        </header>

        {isRainLikely && (
          <aside className="weather-advisory" aria-label="Weather recommendation">
            <div className="weather-advisory-content">
              <span>🌧️ <strong>Rain in the Orchard Park forecast ({rainChance}% chance):</strong> Perfect time to explore indoor libraries, museums, play cafes and games.</span>
              <button
                className={setting === "indoor" ? "active" : ""}
                onClick={() => setSetting(setting === "indoor" ? "all" : "indoor")}
              >
                {setting === "indoor" ? "✓ Filtered to Indoor" : "Show Indoor Activities"}
              </button>
            </div>
          </aside>
        )}

        <section className="browse-bar" aria-label="Event browsing controls">
          <div className="view-tabs">
            <button className={view === "southtowns" ? "active" : ""} onClick={() => setView("southtowns")}>Southtowns</button>
            <button className={view === "city" ? "active" : ""} onClick={() => setView("city")}>Buffalo city</button>
            <button className={view === "all" ? "active" : ""} onClick={() => setView("all")}>All nearby</button>
          </div>
          <label className="search-box">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search events, towns or activities"
              aria-label="Search events"
            />
          </label>
          <button className={showSaved ? "saved-filter active" : "saved-filter"} onClick={() => setShowSaved(!showSaved)}>
            Saved ({saved.length})
          </button>
        </section>

        <div className="filter-controls-row">
          <div className="setting-filter" aria-label="Filter by environment">
            <span>Environment</span>
            <button className={setting === "all" ? "active" : ""} onClick={() => setSetting("all")}>All</button>
            <button className={setting === "indoor" ? "active" : ""} onClick={() => setSetting("indoor")}>🏛️ Indoor</button>
            <button className={setting === "outdoor" ? "active" : ""} onClick={() => setSetting("outdoor")}>🌳 Outdoor</button>
          </div>

          <div className="distance-filter" aria-label="Filter by distance">
            <span>Max radius</span>
            <button className={maxDistance === null ? "active" : ""} onClick={() => setMaxDistance(null)}>All (25 mi)</button>
            <button className={maxDistance === 5 ? "active" : ""} onClick={() => setMaxDistance(5)}>≤ 5 mi</button>
            <button className={maxDistance === 10 ? "active" : ""} onClick={() => setMaxDistance(10)}>≤ 10 mi</button>
            <button className={maxDistance === 15 ? "active" : ""} onClick={() => setMaxDistance(15)}>≤ 15 mi</button>
          </div>
        </div>

        <div className="town-filter" aria-label="Filter by town">
          <span>Filter by town</span>
          {townFilters.map((filter) => (
            <button key={filter} className={town === filter ? "active" : ""} onClick={() => setTown(filter)}>
              {filter}
            </button>
          ))}
        </div>

        <div className="kind-filter" aria-label="Filter by activity">
          <span>What sounds good?</span>
          {kindFilters.map((filter) => (
            <button key={filter} className={kind === filter ? "active" : ""} onClick={() => setKind(filter)}>
              {filter}
            </button>
          ))}
        </div>

        <section id="today" className="events-section">
          <div className="section-title">
            <div>
              <span className="eyebrow">{view === "southtowns" ? "Southtowns first" : view === "city" ? "Buffalo city" : "Within 25 miles"}</span>
              <h2>Today</h2>
            </div>
            <p>{today.length} events</p>
          </div>
          {today.length ? (
            <div className="event-grid">
              {today.map((event) => (
                <EventCard key={event.id} event={event} saved={saved} onToggle={toggleSaved} />
              ))}
            </div>
          ) : (
            <div className="empty-panel">No matching events. Try “All nearby,” another town or radius, or clear your filters.</div>
          )}
        </section>

        <section id="upcoming" className="events-section upcoming-section">
          <div className="section-title">
            <div>
              <span className="eyebrow">Browse by time, town or activity</span>
              <h2>Next 7 days</h2>
            </div>
            <p>{upcoming.length} events</p>
          </div>
          {upcoming.length ? (
            <div className="event-grid">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} saved={saved} onToggle={toggleSaved} />
              ))}
            </div>
          ) : (
            <div className="empty-panel">No matching events for this view.</div>
          )}
        </section>

        <section id="sources" className="source-board">
          <div className="section-title">
            <div>
              <span className="eyebrow">Our reporting desk</span>
              <h2>Where we look</h2>
            </div>
            <p>Town flyers and local reporting are part of the event search, not an afterthought.</p>
          </div>
          <div className="source-grid">
            <div>
              <h3>Town & village calendars</h3>
              <a href="https://www.orchardparkny.gov/events/">Town of Orchard Park ↗</a>
              <a href="https://orchardparkvillageny.gov/village-events/">Village of Orchard Park ↗</a>
              <a href="https://www.townofhamburgny.gov/386/Calendar-of-Events">Town of Hamburg ↗</a>
              <a href="https://villageofhamburgny.gov/events">Village of Hamburg ↗</a>
              <a href="https://www.westseneca.gov/calendar.aspx">West Seneca ↗</a>
              <a href="https://edenny.gov/news/">Eden ↗</a>
              <a href="https://www.elmanewyork.gov/">Elma ↗</a>
              <a href="https://www.bostonny.gov/events">Boston ↗</a>
              <a href="https://townofevansny.gov/">Evans ↗</a>
            </div>
            <div>
              <h3>Flyers, libraries & community desks</h3>
              <a href="https://www.buffalolib.org/">Buffalo & Erie County Public Library ↗</a>
              <a href="https://everythingop.com/about-everythingop/">EverythingOP ↗</a>
              <a href="https://orchardparkchamber.org/">Orchard Park Chamber ↗</a>
              <a href="https://southtownsregionalchamber.org/news-events/">Southtowns Regional Chamber ↗</a>
              <a href="https://www.southbuffalo.org/calendar">South Buffalo Community Association ↗</a>
              <a href="https://www.wnyfamilymagazine.com/search/event/calendar-of-events/index.html">WNY Family Magazine ↗</a>
              <a href="https://stepoutbuffalo.com/all-events/">Step Out Buffalo ↗</a>
            </div>
            <div>
              <h3>Local papers & regional guides</h3>
              <a href="https://www.orchardparkbee.com/">Orchard Park Bee ↗</a>
              <a href="https://www.sun-news.com/">Hamburg Sun ↗</a>
              <a href="https://westseneca.org/members/west-seneca-bee-2/">West Seneca Bee ↗</a>
              <a href="https://www.buffalonews.com/">The Buffalo News ↗</a>
              <a href="https://visitbuffalo.com/events/">Visit Buffalo Niagara ↗</a>
              <a href="https://www3.erie.gov/parks/calendar">Erie County Parks ↗</a>
            </div>
          </div>
        </section>

        <footer className="app-footer">
          <b>The 25-Mile Post</b>
          <span>Event calendars refresh once each morning; Orchard Park weather is fetched live when you open the page.</span>
          <span>Approximate driving distance from central Orchard Park.</span>
          <span>Always confirm registration, weather, tickets and last-minute changes with the linked organizer.</span>
        </footer>
      </div>
      {notice && (
        <button className="toast" onClick={() => setNotice("")} aria-live="polite">
          {notice} <span>×</span>
        </button>
      )}
    </main>
  );
}
