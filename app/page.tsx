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
  days?: string[];
  note?: string;
  image?: string;
};

const events: EventPick[] = [
  {
    id: "destination-dinosaur-today",
    section: "today",
    day: "Today",
    date: "Tue, Aug 11",
    time: "10 AM–5 PM",
    title: "Destination Dinosaur",
    venue: "Buffalo Zoo",
    place: "Buffalo",
    distance: 17,
    description:
      "Walk a trail of life-size animatronic dinosaurs, dig for fossils and catch an educational dino show at noon or 2 PM.",
    cost: "$25.95 adult · $19.95 child",
    source: "Buffalo Zoo",
    url: "https://buffalozoo.org/event/destination-dinosaur/2026-08-11/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Buffalo+Zoo+300+Parkside+Avenue+Buffalo+NY",
    categories: ["Kids", "Educational", "Outdoor"],
    note: "Included with zoo admission · final entry at 4 PM",
  },
  {
    id: "op-preschool-storytime",
    section: "today",
    day: "Today",
    date: "Tue, Aug 11",
    time: "10 AM",
    title: "Preschool Storytime",
    venue: "Orchard Park Public Library",
    place: "Orchard Park",
    distance: 1,
    description:
      "Young readers and their caregivers can share stories and early-literacy activities without turning the morning into a road trip.",
    cost: "Free · registration required",
    source: "Buffalo & Erie County Public Library",
    url: "https://www.buffalolib.org/orchard-park-public-library",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY",
    categories: ["Free", "Kids", "Indoor"],
    note: "Ages 3–5 · child attends with a caregiver",
  },
  {
    id: "hamburg-pokemon-club",
    section: "today",
    day: "Today",
    date: "Tue, Aug 11",
    time: "4–6 PM",
    title: "Pokémon Club",
    venue: "Hamburg Public Library",
    place: "Hamburg",
    distance: 12,
    description:
      "Kids can make Pokémon crafts, trade cards or battle in unlimited format; the library has cards on hand for newcomers.",
    cost: "Free library program",
    source: "Buffalo & Erie County Public Library",
    url: "https://www.buffalolib.org/locations-hours/hamburg-public-library",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Hamburg+Public+Library+102+Buffalo+Street+Hamburg+NY",
    categories: ["Free", "Kids", "Indoor"],
    note: "Ages 6–12 · caregiver required for ages 8 and under",
  },
  {
    id: "family-fort-night",
    section: "today",
    day: "Today",
    date: "Tue, Aug 11",
    time: "5:30 PM",
    title: "Family Fort Night",
    venue: "West Seneca Public Library",
    place: "West Seneca",
    distance: 9,
    description:
      "Bring the crew indoors to build a blanket fort together in the library for a wonderfully low-tech family evening.",
    cost: "Free · registration required",
    source: "Buffalo & Erie County Public Library",
    url: "https://www.buffalolib.org/locations-hours/west-seneca-public-library",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=West+Seneca+Public+Library+1300+Union+Road+West+Seneca+NY",
    categories: ["Free", "Kids", "Indoor", "Unique"],
    note: "Best for ages 2+ · space is limited",
  },
  {
    id: "tangled-in-the-park",
    section: "today",
    day: "Tonight",
    date: "Tue, Aug 11",
    time: "8:30–11 PM",
    title: "Movie in the Park: Tangled",
    venue: "Veterans Memorial Park",
    place: "West Seneca",
    distance: 9,
    description:
      "Bring blankets and lawn chairs for a free, all-ages showing of Disney’s lantern-lit adventure under the stars.",
    cost: "Free",
    source: "Town of West Seneca Recreation",
    url: "https://westsenecany.myrec.com/info/calendar/list.aspx?AreaID=0&FacilityID=14711",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Veterans+Memorial+Park+1250+Union+Road+West+Seneca+NY",
    categories: ["Free", "Kids", "Outdoor", "Movie"],
    note: "Starts at dusk · weather dependent · rain date Aug 18",
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
    cost: "$19 adult · kids 12 & under free",
    source: "Erie County Fair",
    url: "https://www.ecfair.org/p/info/admissionparking",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Hamburg+Fairgrounds+5600+McKinley+Parkway+Hamburg+NY",
    categories: ["Festival", "Kids", "Food", "Outdoor"],
    days: ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"],
    note: "$16 from 11 AM–1 PM · opening day free with 4+ canned goods",
    image: "/events/erie-county-fair.jpg",
  },
  {
    id: "op-reptiles-world",
    section: "week",
    day: "Wed",
    date: "Wed, Aug 12",
    time: "2 PM",
    title: "Reptiles Around the World",
    venue: "Orchard Park Public Library",
    place: "Orchard Park",
    distance: 1,
    description:
      "Repco Wildlife Encounters brings live reptiles to the library for a close-to-home, all-ages animal program.",
    cost: "Free · registration required",
    source: "Buffalo & Erie County Public Library",
    url: "https://www.buffalolib.org/orchard-park-public-library",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY",
    categories: ["Free", "Kids", "Educational", "Indoor"],
    note: "All ages · reserve a spot with the library",
  },
  {
    id: "shakespeare-park",
    section: "week",
    day: "Wed",
    date: "Wed, Aug 12–Sun, Aug 16",
    time: "7 PM",
    title: "The Taming of the Shrew",
    venue: "Shakespeare Hill, Delaware Park",
    place: "Buffalo",
    distance: 16,
    description:
      "Pack a picnic for the closing week of Buffalo’s beloved free Shakespeare tradition under the trees beside Hoyt Lake.",
    cost: "Free · non-ticketed",
    source: "Shakespeare in Delaware Park",
    url: "https://shakespeareindelawarepark.org/mainstage/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Shakespeare+Hill+Delaware+Park+Buffalo+NY",
    categories: ["Free", "Outdoor", "Theater"],
    days: ["Wed", "Thu", "Fri", "Sat", "Sun"],
    note: "Bring a blanket or low chair · weather dependent",
  },
  {
    id: "canalside-kids-tour",
    section: "week",
    day: "Fri",
    date: "Fri, Aug 14",
    time: "10:30 AM",
    title: "Canalside for Kids Walking Tour",
    venue: "Waterway of Change Museum",
    place: "Buffalo",
    distance: 19,
    description:
      "A guide turns the waterfront’s history into a one-mile, stroller-friendly adventure designed especially for kids ages 5–10.",
    cost: "Free · registration required",
    source: "Explore Buffalo",
    url: "https://explorebuffalo.org/waterfront/canalside-for-kids/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Longshed+Building+Canalside+Buffalo+NY",
    categories: ["Free", "Kids", "Educational", "Outdoor"],
    note: "45–60 minutes · limited to 15 guests",
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
    distance: 17,
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
    id: "festival-india",
    section: "week",
    day: "Sat",
    date: "Sat, Aug 15",
    time: "2–8 PM",
    title: "Festival of India",
    venue: "Canalside",
    place: "Buffalo",
    distance: 19,
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
    distance: 18,
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
    id: "south-buffalo-market",
    section: "week",
    day: "Sun",
    date: "Sun, Aug 16",
    time: "9 AM–1 PM",
    title: "South Buffalo Farmers Market",
    venue: "Cazenovia Park Casino lawn",
    place: "Buffalo",
    distance: 12,
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
  {
    id: "au-some-morning",
    section: "week",
    day: "Tue",
    date: "Tue, Aug 18",
    time: "9:30–11:30 AM",
    title: "Au-Some Morning Edition",
    venue: "Explore & More Children’s Museum",
    place: "Buffalo",
    distance: 19,
    description:
      "A sensory-friendly museum morning welcomes autistic children, friends and families for calm play, art, tinkering and therapy animals.",
    cost: "Free · registration required",
    source: "Explore & More",
    url: "https://exploreandmore.org/event/au-some-evening-august-2026/",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=Explore+and+More+130+Main+Street+Buffalo+NY",
    categories: ["Free", "Kids", "Indoor", "Educational"],
    note: "Limited space · designed for sensory needs",
  },
];

const filters = ["All", "Free", "Kids", "Outdoor", "Food", "Music", "Market"];
const days = ["All week", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];

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
    const restoreClippings = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("twenty-five-mile-post-clippings");
        if (stored) setSaved(JSON.parse(stored));
      } catch {
        window.localStorage.removeItem("twenty-five-mile-post-clippings");
      }
    }, 0);

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

    return () => window.clearTimeout(restoreClippings);
  }, []);

  const visibleWeek = useMemo(
    () =>
      events.filter((event) => {
        if (event.section !== "week") return false;
        if (event.distance > maxDistance) return false;
        if (showClippings && !saved.includes(event.id)) return false;
        if (activeFilter !== "All" && !event.categories.includes(activeFilter)) return false;
        if (activeDay !== "All week" && !(event.days ?? [event.day]).includes(activeDay)) return false;
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
            <span>Morning edition · Tuesday, August 11, 2026</span>
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
              <small>Live forecast · listings verified 7:00 AM EDT</small>
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
            Five family plans today <i>◆</i> Erie County Fair opens Wednesday <i>◆</i> Ten vetted picks through Tuesday
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
              <p className="section-kicker">Top pick · opens Wednesday</p>
              <h2>The fair is the family outing that earns a full day.</h2>
              <p className="drop-cap">
                Six miles from home, the Erie County Fair offers the rare all-ages mix: little kids can meet farm animals, bigger kids get the midway, and adults can make a highly defensible lunch out of fried dough.
              </p>
              <div className="lead-facts">
                <span><b>When</b> Aug 12–23, 11 AM–10 PM</span>
                <span><b>Where</b> Hamburg Fairgrounds</span>
                <span><b>Cost</b> $19 adult; kids 12 and under free</span>
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
            <h2>Dinosaurs first. A movie after dark.</h2>
            <p>
              Today’s short list runs from a 10 AM storytime to an 8:30 PM movie. Three picks are within 12 miles, and four are free or standard library programs.
            </p>
            <div className="mini-ranking">
              <div><span>01</span><p><b>Best all-day plan</b> Destination Dinosaur at the zoo</p></div>
              <div><span>02</span><p><b>Closest plan</b> Preschool Storytime, one mile away</p></div>
              <div><span>03</span><p><b>Best late plan</b> <i>Tangled</i> under the stars</p></div>
            </div>
            <button onClick={surpriseMe} className="surprise-button">✦ Let the presses pick</button>
            <p className="weather-caution">Times, weather and availability can change. Open the source before leaving.</p>
          </aside>
        </section>

        <section id="today" className="today-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Tuesday’s morning edition</p>
              <h2>Today</h2>
            </div>
            <p>The best 5 happening today, from first story to final credits.</p>
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
              <p className="section-kicker">Wednesday, Aug 12 → Tuesday, Aug 18</p>
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
            <p>Erie County Fair · Buffalo Zoo · Buffalo Waterfront · Buffalo Olmsted Parks · local libraries · West Seneca Recreation · Explore Buffalo · Shakespeare in Delaware Park · Visit Buffalo Niagara · Explore & More</p>
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
