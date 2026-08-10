"use client";

import { useEffect, useMemo, useState } from "react";

type EventPick = {
  id: string;
  section: "today" | "week";
  day: string;
  date: string;
  time: string;
  title: string;
  venue: string;
  place: string;
  distance: number;
  description: string;
  cost: string;
  source: string;
  url: string;
  mapUrl: string;
  categories: string[];
  note?: string;
  image?: string;
};

const events: EventPick[] = [
  {
    id: "levitt-vibe-tonight",
    section: "today",
    day: "Tonight",
    date: "Mon, Aug 10",
    time: "5:30–8 PM",
    title: "Levitt VIBE: Will Holton & Drea d’Nur",
    venue: "Ralph C. Wilson Jr. Centennial Park",
    place: "Buffalo",
    distance: 15,
    description:
      "Spread out by the lake for a free, all-ages funk and soul show with food trucks, lawn space and room for kids to move.",
    cost: "Free",
    source: "Visit Buffalo Niagara",
    url: "https://visitbuffalo.com/event/levitt-vibe-music-series/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Ralph+C+Wilson+Jr+Centennial+Park+Buffalo+NY",
    categories: ["Free", "Outdoor", "Music"],
    note: "Happening now · bring chairs or a blanket",
  },
  {
    id: "tnt-river-grove",
    section: "today",
    day: "Tonight",
    date: "Mon, Aug 10",
    time: "5–8:30 PM",
    title: "TNT Acoustic Duo Under the Pavilion",
    venue: "Buffalo River Grove",
    place: "West Seneca",
    distance: 10,
    description:
      "A rain-or-shine acoustic concert beneath a covered pavilion, with affordable food for sale and plenty of casual seating.",
    cost: "Free admission",
    source: "Step Out Buffalo",
    url: "https://stepoutbuffalo.com/event/free-concert-live-music-by-the-tnt-acoustic-duo-at-the-buffalo-river-grove/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Buffalo+River+Grove+2299+Clinton+Street+West+Seneca+NY",
    categories: ["Free", "Music", "Food"],
    note: "Food and cash bar available; no outside food",
  },
  {
    id: "teen-game-night",
    section: "today",
    day: "Tonight",
    date: "Mon, Aug 10",
    time: "6–7 PM",
    title: "Teen Game Night",
    venue: "Orchard Park Public Library",
    place: "Orchard Park",
    distance: 1,
    description:
      "Local teens can drop into an easygoing hour of board and card games without turning tonight into a long drive.",
    cost: "Free · registration requested",
    source: "Buffalo & Erie County Public Library",
    url: "https://www.buffalolib.org/orchard-park-public-library",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY",
    categories: ["Free", "Kids", "Indoor"],
    note: "Ages 13–17",
  },
  {
    id: "sheas-historic-tour",
    section: "today",
    day: "Tonight",
    date: "Mon, Aug 10",
    time: "6 PM",
    title: "Shea’s Centennial Historic Tour",
    venue: "Shea’s Buffalo Theatre",
    place: "Buffalo",
    distance: 15,
    description:
      "Step inside Buffalo’s gilded movie palace for a small-group look at its Tiffany-designed interior and century of show history.",
    cost: "$25 per person",
    source: "Shea’s Performing Arts Center",
    url: "https://www.sheas.org/historic-tours/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Sheas+Buffalo+Theatre+646+Main+Street+Buffalo+NY",
    categories: ["Indoor", "Educational", "Unique"],
    note: "Advance reservation required · only 20 spots",
  },
  {
    id: "delaware-flow-jam",
    section: "today",
    day: "Tonight",
    date: "Mon, Aug 10",
    time: "7–10 PM",
    title: "Delaware Park Flow Jam",
    venue: "Delaware Park at Hoyt Lake",
    place: "Buffalo",
    distance: 16,
    description:
      "Catch local performers, live music and a public fire-arts showcase beside Hoyt Lake for a one-of-a-kind summer evening.",
    cost: "Free",
    source: "City of Buffalo",
    url: "https://www.buffalony.gov/Calendar.aspx?EID=6245",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Hoyt+Lake+Delaware+Park+Buffalo+NY",
    categories: ["Free", "Outdoor", "Music", "Unique"],
    note: "Fire performance · close supervision recommended",
  },
  {
    id: "erie-county-fair",
    section: "week",
    day: "Wed",
    date: "Wed, Aug 12–Sun, Aug 23",
    time: "11 AM–10 PM daily",
    title: "Erie County Fair",
    venue: "Hamburg Fairgrounds",
    place: "Hamburg",
    distance: 6,
    description:
      "The region’s giant summer fair packs rides, 4-H animals, agricultural exhibits, free shows and gloriously over-the-top fair food into one day out.",
    cost: "$19 · $16 early bird",
    source: "Erie County Fair",
    url: "https://www.ecfair.org/p/info/admissionparking",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Hamburg+Fairgrounds+5600+McKinley+Parkway+Hamburg+NY",
    categories: ["Festival", "Kids", "Food", "Outdoor"],
    note: "Opening day: free with 4+ nonperishable food items",
    image: "/events/erie-county-fair.jpg",
  },
  {
    id: "destination-dinosaur",
    section: "week",
    day: "Tue",
    date: "Daily through Mon, Aug 17",
    time: "10 AM–5 PM",
    title: "Destination Dinosaur",
    venue: "Buffalo Zoo",
    place: "Buffalo",
    distance: 16,
    description:
      "Walk among life-size animatronic dinosaurs, try the fossil dig and catch an educational dino show at noon or 2 PM.",
    cost: "$25.95 adult · $19.95 child",
    source: "Buffalo Zoo",
    url: "https://buffalozoo.org/event/destination-dinosaur/2026-08-11/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Buffalo+Zoo+300+Parkside+Avenue+Buffalo+NY",
    categories: ["Kids", "Educational", "Outdoor"],
    note: "Exhibit included with zoo admission",
  },
  {
    id: "wild-robot-movie",
    section: "week",
    day: "Fri",
    date: "Fri, Aug 14",
    time: "7–10 PM · film at sunset",
    title: "Family Movie Night: The Wild Robot",
    venue: "Prospect Park",
    place: "Buffalo",
    distance: 16,
    description:
      "Bring blankets and chairs for a free outdoor showing of the tender animated adventure, with light refreshments before the film.",
    cost: "Free",
    source: "Buffalo Olmsted Parks Conservancy",
    url: "https://www.bfloparks.org/event/movie-nights/2026-08-14/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Prospect+Park+Connecticut+Street+Buffalo+NY",
    categories: ["Free", "Kids", "Outdoor", "Movie"],
    note: "Weather dependent · refreshments first come, first served",
  },
  {
    id: "shakespeare-park",
    section: "week",
    day: "Thu",
    date: "Thu, Aug 13–Sun, Aug 16",
    time: "7 PM",
    title: "The Taming of the Shrew",
    venue: "Shakespeare Hill, Delaware Park",
    place: "Buffalo",
    distance: 16,
    description:
      "Pack a picnic for the closing weekend of Buffalo’s beloved free Shakespeare tradition under the trees beside Hoyt Lake.",
    cost: "Free · non-ticketed",
    source: "Shakespeare in Delaware Park",
    url: "https://shakespeareindelawarepark.org/season/2026-51st-season/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Shakespeare+Hill+Delaware+Park+Buffalo+NY",
    categories: ["Free", "Outdoor", "Theater"],
    note: "Bring a blanket or low chair · weather dependent",
  },
  {
    id: "festival-india",
    section: "week",
    day: "Sat",
    date: "Sat, Aug 15",
    time: "2–8 PM",
    title: "Festival of India",
    venue: "Canalside",
    place: "Buffalo",
    distance: 16,
    description:
      "A bright waterfront celebration of Indian dance, music, food, art and community designed to welcome every age.",
    cost: "Free",
    source: "Buffalo Waterfront",
    url: "https://buffalowaterfront.com/events/festivalofindia",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Canalside+44+Prime+Street+Buffalo+NY",
    categories: ["Free", "Festival", "Food", "Kids", "Outdoor"],
    note: "All ages welcome",
    image: "/events/festival-of-india.jpg",
  },
  {
    id: "puerto-rican-parade",
    section: "week",
    day: "Sat",
    date: "Sat, Aug 15",
    time: "Noon",
    title: "Puerto Rican & Hispanic Day Parade",
    venue: "Niagara Street to Niagara Square",
    place: "Buffalo",
    distance: 16,
    description:
      "Cheer on a colorful cultural parade down Avenida San Juan, then stay for the free community concert in Niagara Square.",
    cost: "Free",
    source: "Parade of WNY",
    url: "https://www.prhdp.org/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Niagara+Square+Buffalo+NY",
    categories: ["Free", "Festival", "Music", "Outdoor"],
    note: "Parade at noon · concert follows",
  },
  {
    id: "elmwood-market",
    section: "week",
    day: "Sat",
    date: "Sat, Aug 15",
    time: "8 AM–1 PM",
    title: "Elmwood Village Farmers Market",
    venue: "Bidwell Parkway at Elmwood",
    place: "Buffalo",
    distance: 16,
    description:
      "Browse a producer-only market full of local fruit, vegetables, baked goods and easy breakfast provisions beneath the parkway trees.",
    cost: "Free entry",
    source: "Elmwood Village Farmers Market",
    url: "https://www.elmwoodmarket.org/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Bidwell+Parkway+Elmwood+Avenue+Buffalo+NY",
    categories: ["Free", "Market", "Food", "Outdoor"],
    note: "Pay vendors for purchases",
  },
  {
    id: "south-buffalo-market",
    section: "week",
    day: "Sun",
    date: "Sun, Aug 16",
    time: "9 AM–1 PM",
    title: "South Buffalo Farmers Market",
    venue: "Cazenovia Park Casino lawn",
    place: "Buffalo",
    distance: 8,
    description:
      "A close-to-home Sunday market with local growers and makers, live music, free yoga and neighborhood bike rides.",
    cost: "Free entry",
    source: "South Buffalo Farmers Market",
    url: "https://southbuffalofarmersmarket.com/visit-the-market",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Cazenovia+Park+Casino+Buffalo+NY",
    categories: ["Free", "Market", "Food", "Outdoor"],
    note: "Yoga begins at 9:30 AM",
  },
  {
    id: "levitt-la-krema",
    section: "week",
    day: "Mon",
    date: "Mon, Aug 17",
    time: "5:30–8 PM",
    title: "Levitt VIBE: La Krema",
    venue: "Ralph C. Wilson Jr. Centennial Park",
    place: "Buffalo",
    distance: 15,
    description:
      "End the seven-day run with another free waterfront concert near the splash pad, skate plaza and generous picnic lawns.",
    cost: "Free",
    source: "Visit Buffalo Niagara",
    url: "https://visitbuffalo.com/event/levitt-vibe-music-series/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Ralph+C+Wilson+Jr+Centennial+Park+Buffalo+NY",
    categories: ["Free", "Music", "Outdoor"],
    note: "Bring chairs or a blanket",
  },
];

const filters = ["All", "Free", "Kids", "Outdoor", "Food", "Music", "Market"];
const days = ["All week", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"];

function weatherLabel(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Misty";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain possible";
  if (code <= 77) return "Wintry";
  if (code >= 95) return "Storms possible";
  return "Changeable skies";
}

function EventActions({ event }: { event: EventPick }) {
  return (
    <div className="event-actions">
      <a href={event.url} target="_blank" rel="noreferrer" className="source-link">
        See listing <span aria-hidden="true">↗</span>
      </a>
      <a href={event.mapUrl} target="_blank" rel="noreferrer" className="map-link">
        Map
      </a>
    </div>
  );
}

export default function Home() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [activeDay, setActiveDay] = useState("All week");
  const [maxDistance, setMaxDistance] = useState(25);
  const [saved, setSaved] = useState<string[]>([]);
  const [showClippings, setShowClippings] = useState(false);
  const [notice, setNotice] = useState("");
  const [weather, setWeather] = useState("Checking the Orchard Park sky…");

  useEffect(() => {
    const stored = window.localStorage.getItem("twenty-five-mile-post-clippings");
    if (stored) setSaved(JSON.parse(stored));

    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=42.767&longitude=-78.744&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FNew_York",
    )
      .then((response) => response.json())
      .then((data) => {
        const current = Math.round(data.current.temperature_2m);
        const high = Math.round(data.daily.temperature_2m_max[0]);
        const rain = data.daily.precipitation_probability_max[0];
        setWeather(`${weatherLabel(data.current.weather_code)} · ${current}° now · ${high}° high · ${rain}% rain`);
      })
      .catch(() => setWeather("Forecast unavailable · check before outdoor plans"));
  }, []);

  const visibleWeek = useMemo(
    () =>
      events.filter((event) => {
        if (event.section !== "week") return false;
        if (event.distance > maxDistance) return false;
        if (showClippings && !saved.includes(event.id)) return false;
        if (activeFilter !== "All" && !event.categories.includes(activeFilter)) return false;
        if (activeDay !== "All week" && event.day !== activeDay) return false;
        return true;
      }),
    [activeDay, activeFilter, maxDistance, saved, showClippings],
  );

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    window.localStorage.setItem("twenty-five-mile-post-clippings", JSON.stringify(next));
    setNotice(saved.includes(id) ? "Removed from your clippings." : "Clipped for later on this device.");
  };

  const shareEdition = async () => {
    const shareData = {
      title: "The 25-Mile Post",
      text: "Family things to do today and this week around Orchard Park.",
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setNotice("Edition link copied.");
      }
    } catch {
      setNotice("Sharing was cancelled.");
    }
  };

  const surpriseMe = () => {
    const pool = visibleWeek.length ? visibleWeek : events.filter((event) => event.section === "week");
    const pick = pool[Math.floor(Math.random() * pool.length)];
    document.getElementById(pick.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setNotice(`The presses pick: ${pick.title}.`);
  };

  return (
    <main>
      <div className="paper-shell">
        <header className="masthead">
          <div className="masthead-top">
            <span>Family field notes for Buffalo’s Southtowns</span>
            <span>Late edition · Monday, August 10, 2026</span>
            <button onClick={shareEdition} className="text-button" aria-label="Share this edition">
              Share edition ↗
            </button>
          </div>
          <div className="brand-row">
            <div className="edition-seal" aria-hidden="true">
              <span>THE</span>
              <strong>25</strong>
              <span>MILE</span>
            </div>
            <div className="brand-copy">
              <p className="eyebrow">Orchard Park, New York</p>
              <h1>The 25-Mile Post</h1>
              <p>Your family’s handpicked guide to a very good week nearby.</p>
            </div>
            <div className="weather-box">
              <span>Today’s outlook</span>
              <strong>{weather}</strong>
              <small>Live forecast · plans verified 5:35 PM EDT</small>
            </div>
          </div>
          <nav className="section-nav" aria-label="Edition sections">
            <a href="#today">Today</a>
            <a href="#top-pick">Top pick</a>
            <a href="#this-week">This week</a>
            <a href="#sources">The fine print</a>
          </nav>
        </header>

        <section className="ticker" aria-label="Edition summary">
          <span className="ticker-label">Just in</span>
          <p>
            Five ways out tonight <i>◆</i> Erie County Fair opens Wednesday <i>◆</i> Nine strong picks through Monday
          </p>
        </section>

        <section id="top-pick" className="lead-grid">
          <article className="lead-story">
            <div className="lead-image-wrap">
              <img
                src="/events/erie-county-fair.jpg"
                alt="Families walking through the colorful Erie County Fair midway at sunset"
              />
              <span className="photo-credit">File photo · Erie County Fair midway</span>
            </div>
            <div className="lead-copy">
              <p className="section-kicker">Top pick · Wednesday</p>
              <h2>The fair is the family outing that earns a full day.</h2>
              <p className="drop-cap">
                Six miles from home, the Erie County Fair offers the rare all-ages mix: little kids can meet farm animals, bigger kids get the midway, and adults can make a highly defensible lunch out of fried dough.
              </p>
              <div className="lead-facts">
                <span><b>When</b> Aug 12–23, 11 AM–10 PM</span>
                <span><b>Where</b> Hamburg Fairgrounds</span>
                <span><b>Cost</b> $19; opening-day food drive can make admission free</span>
              </div>
              <div className="lead-actions">
                <a href="https://www.ecfair.org/p/info/admissionparking" target="_blank" rel="noreferrer" className="primary-button">
                  Plan the fair day <span aria-hidden="true">→</span>
                </a>
                <button onClick={() => toggleSaved("erie-county-fair")} className="clip-button">
                  {saved.includes("erie-county-fair") ? "✓ Clipped" : "+ Clip this pick"}
                </button>
              </div>
            </div>
          </article>

          <aside className="editor-note">
            <p className="section-kicker">From the family desk</p>
            <h2>Tonight isn’t over yet.</h2>
            <p>
              This late edition only includes timed events that were still happening or had not started when we checked. The strongest move is the free Levitt VIBE concert by the lake; the library is the lowest-effort play for teens.
            </p>
            <div className="mini-ranking">
              <div><span>01</span><p><b>Best free plan</b> Levitt VIBE at Ralph Wilson Park</p></div>
              <div><span>02</span><p><b>Closest plan</b> Teen Game Night, one mile away</p></div>
              <div><span>03</span><p><b>Most unusual</b> Fire arts beside Hoyt Lake</p></div>
            </div>
            <button onClick={surpriseMe} className="surprise-button">✦ Let the presses pick</button>
            <p className="weather-caution">Times, weather and availability can change. Open the source before leaving.</p>
          </aside>
        </section>

        <section id="today" className="today-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Monday’s late edition</p>
              <h2>Today</h2>
            </div>
            <p>The best 5 still within reach tonight, ordered from easiest to most adventurous.</p>
          </div>

          <div className="today-grid">
            {events.filter((event) => event.section === "today").map((event, index) => (
              <article className={`today-card ${index === 0 ? "today-card-featured" : ""}`} key={event.id}>
                <div className="card-topline">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{event.distance} mi from Orchard Park</span>
                </div>
                <p className="event-time">{event.time}</p>
                <h3>{event.title}</h3>
                <p className="event-venue">{event.venue} · {event.place}</p>
                <p className="event-description">{event.description}</p>
                <div className="tag-row">
                  {event.categories.slice(0, 3).map((category) => <span key={category}>{category}</span>)}
                </div>
                <div className="cost-line"><b>{event.cost}</b><span>{event.note}</span></div>
                <div className="card-footer">
                  <EventActions event={event} />
                  <button
                    onClick={() => toggleSaved(event.id)}
                    className="clip-icon"
                    aria-label={`${saved.includes(event.id) ? "Remove" : "Save"} ${event.title}`}
                    title="Clip this event"
                  >
                    {saved.includes(event.id) ? "✓" : "+"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="this-week" className="week-section">
          <div className="section-heading week-heading">
            <div>
              <p className="section-kicker">Tuesday, Aug 11 → Monday, Aug 17</p>
              <h2>This week</h2>
            </div>
            <p>Filter the family calendar. Your clippings stay on this device.</p>
          </div>

          <div className="filter-desk" aria-label="Event filters">
            <div className="filter-block">
              <span className="filter-label">I’m in the mood for</span>
              <div className="filter-pills">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    className={activeFilter === filter ? "active" : ""}
                    onClick={() => setActiveFilter(filter)}
                    aria-pressed={activeFilter === filter}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-block">
              <span className="filter-label">Pick a day</span>
              <div className="filter-pills day-pills">
                {days.map((day) => (
                  <button
                    key={day}
                    className={activeDay === day ? "active" : ""}
                    onClick={() => setActiveDay(day)}
                    aria-pressed={activeDay === day}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-bottom">
              <label>
                Maximum drive
                <select value={maxDistance} onChange={(event) => setMaxDistance(Number(event.target.value))}>
                  <option value="10">10 miles</option>
                  <option value="15">15 miles</option>
                  <option value="20">20 miles</option>
                  <option value="25">25 miles</option>
                </select>
              </label>
              <button className={showClippings ? "clippings-toggle active" : "clippings-toggle"} onClick={() => setShowClippings(!showClippings)}>
                My clippings ({saved.length})
              </button>
              <span className="result-count">{visibleWeek.length} {visibleWeek.length === 1 ? "story" : "stories"} on the desk</span>
            </div>
          </div>

          <div className="week-list" aria-live="polite">
            {visibleWeek.map((event, index) => (
              <article className="week-story" id={event.id} key={event.id}>
                <div className="week-index">{String(index + 1).padStart(2, "0")}</div>
                {event.image && event.id !== "erie-county-fair" ? (
                  <img src={event.image} alt="Festival-goers carrying Indian and American flags at Canalside" />
                ) : (
                  <div className={`date-block day-${event.day.toLowerCase()}`}>
                    <span>{event.day}</span>
                    <strong>{event.date.match(/Aug\s(\d+)/)?.[1] ?? "—"}</strong>
                  </div>
                )}
                <div className="week-copy">
                  <p className="event-time">{event.date} · {event.time}</p>
                  <h3>{event.title}</h3>
                  <p className="event-venue">{event.venue} · {event.place} · about {event.distance} mi</p>
                  <p className="event-description">{event.description}</p>
                  <div className="story-meta">
                    <span className="cost-chip">{event.cost}</span>
                    <span>{event.note}</span>
                  </div>
                </div>
                <div className="week-actions">
                  <button
                    onClick={() => toggleSaved(event.id)}
                    className={saved.includes(event.id) ? "save-story saved" : "save-story"}
                  >
                    {saved.includes(event.id) ? "✓ Clipped" : "+ Clip"}
                  </button>
                  <EventActions event={event} />
                  <small>via {event.source}</small>
                </div>
              </article>
            ))}
            {visibleWeek.length === 0 && (
              <div className="empty-state">
                <span>Nothing made this cut.</span>
                <p>Try another day, widen the drive, or show all categories.</p>
                <button onClick={() => { setActiveFilter("All"); setActiveDay("All week"); setMaxDistance(25); setShowClippings(false); }}>
                  Reset the desk
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="weekend-spread">
          <img src="/events/festival-of-india.jpg" alt="Festival of India procession at Buffalo’s waterfront" />
          <div>
            <p className="section-kicker">Saturday color</p>
            <h2>Two cultures, one excellent parade day.</h2>
            <p>
              Start on Niagara Street for the Puerto Rican & Hispanic Day Parade at noon, then head to Canalside for the Festival of India from 2–8 PM. Both are free, outdoors and rich in music, food and color.
            </p>
            <a href="https://buffalowaterfront.com/events/festivalofindia" target="_blank" rel="noreferrer">Read the waterfront listing →</a>
          </div>
        </section>

        <footer id="sources" className="paper-footer">
          <div>
            <p className="footer-brand">The 25-Mile Post</p>
            <p>A morning family field guide centered on Orchard Park, New York.</p>
          </div>
          <div>
            <b>How this edition was made</b>
            <p>
              Current local listings were checked across official venue calendars, municipal feeds and trusted Western New York guides. Duplicates, ended events, nightlife and obvious long-haul picks were removed.
            </p>
          </div>
          <div>
            <b>Distance & accuracy</b>
            <p>
              Mileage is approximate from central Orchard Park. Confirm tickets, registration, weather and last-minute changes with the linked organizer before leaving.
            </p>
          </div>
          <div className="source-roll">
            <b>Sources in this issue</b>
            <p>Erie County Fair · Buffalo Zoo · Buffalo Waterfront · City of Buffalo · Buffalo Olmsted Parks · local libraries · Step Out Buffalo · Shea’s · Visit Buffalo Niagara</p>
          </div>
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
