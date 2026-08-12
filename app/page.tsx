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
  region: "southtowns" | "city";
  days?: string[];
  note?: string;
  image?: string;
};

const events: EventPick[] = [
  { id: "erie-fair-today", section: "today", region: "southtowns", day: "Today", date: "Wed, Aug 12", time: "11 AM–10 PM (midway noon–11)", title: "Erie County Fair · Opening Day", venue: "Hamburg Fairgrounds", place: "Hamburg", distance: 6, description: "Rides, farm animals, 4-H exhibits, food and opening-day community spirit make this the Southtowns’ biggest family outing.", cost: "Free with 4+ canned goods · otherwise $19 adult", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Fairgrounds+5600+McKinley+Parkway+Hamburg+NY", categories: ["Festival", "Kids", "Food", "Outdoor"], note: "Kids 12 and under free with an adult · free parking", image: "/events/erie-county-fair.jpg" },
  { id: "op-reptiles-today", section: "today", region: "southtowns", day: "Today", date: "Wed, Aug 12", time: "2 PM", title: "Reptiles Around the World", venue: "Orchard Park Public Library", place: "Orchard Park", distance: 1, description: "Repco Wildlife Encounters brings live reptiles to the library for a close-to-home, all-ages animal program.", cost: "Free · registration required", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/orchard-park-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY", categories: ["Free", "Kids", "Educational", "Indoor"], note: "Reserve a spot with the library" },
  { id: "elma-fossil-today", section: "today", region: "southtowns", day: "Today", date: "Wed, Aug 12", time: "2–3 PM", title: "Fossil Frenzy Play Cafe", venue: "Elma Public Library", place: "Elma", distance: 10, description: "Handle fossils and explore a digital microscope in a hands-on, all-ages library play session.", cost: "Free · no registration", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/locations-hours/elma-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Elma+Public+Library+Elma+NY", categories: ["Free", "Kids", "Educational", "Indoor"], note: "Drop-in program" },
  { id: "hamburg-storytime-today", section: "today", region: "southtowns", day: "Today", date: "Wed, Aug 12", time: "10:30 or 11:30 AM", title: "Hamburg Public Library Story Time", venue: "Hamburg Public Library", place: "Hamburg", distance: 12, description: "Themed stories, crafts and movement for young children and caregivers in a welcoming indoor setting.", cost: "Free · registration required", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/locations-hours/hamburg-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Public+Library+102+Buffalo+Street+Hamburg+NY", categories: ["Free", "Kids", "Indoor"], note: "Ages 2+ · two session times" },
  { id: "destination-dinosaur-today", section: "today", region: "city", day: "Today", date: "Wed, Aug 12", time: "10 AM–5 PM", title: "Destination Dinosaur", venue: "Buffalo Zoo", place: "Buffalo", distance: 17, description: "Walk a trail of life-size animatronic dinosaurs, dig for fossils and catch educational dino shows at noon and 2 PM.", cost: "$25.95 adult · $19.95 child", source: "Buffalo Zoo", url: "https://buffalozoo.org/event/destination-dinosaur/2026-08-12/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Buffalo+Zoo+300+Parkside+Avenue+Buffalo+NY", categories: ["Kids", "Educational", "Outdoor"], note: "Included with zoo admission · final entry at 4 PM" },
  { id: "erie-county-fair", section: "week", region: "southtowns", day: "Wed", date: "Wed, Aug 12–Sun, Aug 23", time: "11 AM–10 PM daily", title: "Erie County Fair", venue: "Hamburg Fairgrounds", place: "Hamburg", distance: 6, description: "The region’s giant summer fair packs rides, 4-H animals, agricultural exhibits and gloriously over-the-top fair food into one day out.", cost: "$19 adult · kids 12 & under free", source: "Erie County Fair", url: "https://www.ecfair.org/p/info/admissionparking", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Fairgrounds+5600+McKinley+Parkway+Hamburg+NY", categories: ["Festival", "Kids", "Food", "Outdoor"], days: ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"], note: "Sensory Day Thu Aug 13 · $16 early bird 11 AM–1 PM", image: "/events/erie-county-fair.jpg" },
  { id: "lake-shore-storytime", section: "week", region: "southtowns", day: "Thu", date: "Thu, Aug 13", time: "10 AM", title: "StoryTime Shookup", venue: "Lake Shore Branch Library", place: "Hamburg / Lakeshore", distance: 9, description: "Silly stories, music, movement and a craft make this a breezy morning for preschoolers and caregivers.", cost: "Free · no registration", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/locations-hours/lake-shore-branch-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Lake+Shore+Branch+Library+4857+Lake+Shore+Road+Hamburg+NY", categories: ["Free", "Kids", "Indoor"], note: "Drop-in library program" },
  { id: "boston-bubble-day", section: "week", region: "southtowns", day: "Thu", date: "Thu, Aug 13", time: "4:30–6:30 PM", title: "Annual Bubble Day", venue: "Boston Free Library", place: "Boston", distance: 17, description: "Test giant bubbles, experiment with wands and make a soapy science memory together.", cost: "Free · registration required", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/locations-hours/boston-free-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Boston+Free+Library+9475+Boston+State+Road+Boston+NY", categories: ["Free", "Kids", "Outdoor", "Educational"], note: "All ages · call 716-941-3516 to register" },
  { id: "hamburg-game-night", section: "week", region: "southtowns", day: "Thu", date: "Thu, Aug 13", time: "5–7 PM", title: "Family Game Night", venue: "Hamburg Public Library", place: "Hamburg", distance: 12, description: "Board games and low-key family competition make an easy after-dinner outing close to home.", cost: "Free library program", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/locations-hours/hamburg-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Hamburg+Public+Library+102+Buffalo+Street+Hamburg+NY", categories: ["Free", "Kids", "Indoor", "Unique"], note: "Check the branch page for registration details" },
  { id: "op-dinosaur-escape", section: "week", region: "southtowns", day: "All week", date: "Sat, Aug 8–Sat, Aug 22", time: "During library hours", title: "Dinosaur Escape!", venue: "Orchard Park Public Library", place: "Orchard Park", distance: 1, description: "Solve a 45-minute dinosaur-themed escape room with your family without leaving Orchard Park.", cost: "Free · registration required", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/orchard-park-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY", categories: ["Free", "Kids", "Indoor", "Unique"], days: ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"], note: "Groups up to 6 · under 13s need an adult" },
  { id: "south-buffalo-market", section: "week", region: "southtowns", day: "Sun", date: "Sun, Aug 16", time: "9 AM–1 PM", title: "South Buffalo Farmers Market", venue: "Cazenovia Park Casino lawn", place: "South Buffalo", distance: 12, description: "Local growers and makers, live music, free yoga and neighborhood bike rides make Sunday morning feel neighborly.", cost: "Free entry", source: "South Buffalo Farmers Market", url: "https://southbuffalofarmersmarket.com/visit-the-market", mapUrl: "https://www.google.com/maps/search/?api=1&query=Cazenovia+Park+Casino+Buffalo+NY", categories: ["Free", "Market", "Food", "Outdoor"], note: "Yoga begins at 9:30 AM" },
  { id: "op-read-to-dog", section: "week", region: "southtowns", day: "Wed", date: "Wed, Aug 19", time: "4–5 PM", title: "Read to a Dog", venue: "Orchard Park Public Library", place: "Orchard Park", distance: 1, description: "Children can practice reading with a certified therapy dog in a relaxed, confidence-building library visit.", cost: "Free · drop-in", source: "Buffalo & Erie County Public Library", url: "https://www.buffalolib.org/locations-hours/orchard-park-public-library", mapUrl: "https://www.google.com/maps/search/?api=1&query=Orchard+Park+Public+Library+Orchard+Park+NY", categories: ["Free", "Kids", "Indoor", "Unique"], note: "All ages · no registration" },
  { id: "shakespeare-park", section: "week", region: "city", day: "Thu", date: "Thu, Aug 13–Sun, Aug 16", time: "7 PM", title: "The Taming of the Shrew", venue: "Shakespeare Hill, Delaware Park", place: "Buffalo", distance: 16, description: "Pack a picnic for Buffalo’s beloved free Shakespeare tradition under the trees beside Hoyt Lake.", cost: "Free · non-ticketed", source: "Shakespeare in Delaware Park", url: "https://shakespeareindelawarepark.org/mainstage/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Shakespeare+Hill+Delaware+Park+Buffalo+NY", categories: ["Free", "Outdoor", "Theater"], days: ["Thu", "Fri", "Sat", "Sun"], note: "Bring a blanket or low chair · weather dependent" },
  { id: "wild-robot-movie", section: "week", region: "city", day: "Fri", date: "Fri, Aug 14", time: "7–10 PM · film at sunset", title: "Family Movie Night: The Wild Robot", venue: "Prospect Park", place: "Buffalo", distance: 17, description: "Bring blankets and chairs for a free outdoor showing of the tender animated adventure.", cost: "Free", source: "Buffalo Olmsted Parks Conservancy", url: "https://www.bfloparks.org/event/movie-nights/2026-08-14/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Prospect+Park+Connecticut+Street+Buffalo+NY", categories: ["Free", "Kids", "Outdoor", "Movie"], note: "Weather dependent · refreshments first come, first served" },
  { id: "festival-india", section: "week", region: "city", day: "Sat", date: "Sat, Aug 15", time: "2–8 PM", title: "Festival of India", venue: "Canalside", place: "Buffalo", distance: 19, description: "A waterfront celebration of Indian dance, music, food, art and community designed to welcome every age.", cost: "Free", source: "Buffalo Waterfront", url: "https://buffalowaterfront.com/events/festivalofindia", mapUrl: "https://www.google.com/maps/search/?api=1&query=Canalside+44+Prime+Street+Buffalo+NY", categories: ["Free", "Festival", "Food", "Kids", "Outdoor"], note: "All ages welcome · verify final schedule", image: "/events/festival-of-india.jpg" },
  { id: "bisons-super-hero", section: "week", region: "city", day: "Sun", date: "Sun, Aug 16", time: "6:35 PM first pitch", title: "Bisons Super Hero Night", venue: "Sahlen Field", place: "Buffalo", distance: 19, description: "A family baseball night with Marvel comic giveaways, costume photos and postgame fireworks.", cost: "$22 single · $99 family pack", source: "Buffalo Bisons", url: "https://www.milb.com/buffalo/events/marvel", mapUrl: "https://www.google.com/maps/search/?api=1&query=Sahlen+Field+1+James+D+Griffin+Plaza+Buffalo+NY", categories: ["Kids", "Sport", "Outdoor"], note: "Gates 5:30 PM · first 2,500 fans get a comic" },
  { id: "au-some-morning", section: "week", region: "city", day: "Tue", date: "Tue, Aug 18", time: "9:30–11:30 AM", title: "Au-Some Morning Edition", venue: "Explore & More Children’s Museum", place: "Buffalo", distance: 19, description: "A sensory-friendly museum morning welcomes autistic children, friends and families for calm play, art and tinkering.", cost: "Free · registration required", source: "Explore & More", url: "https://exploreandmore.org/education/au-some-evenings/", mapUrl: "https://www.google.com/maps/search/?api=1&query=Explore+and+More+130+Main+Street+Buffalo+NY", categories: ["Free", "Kids", "Indoor", "Educational"], note: "Limited space · designed for sensory needs" },
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
  const [activeRegion, setActiveRegion] = useState<"southtowns" | "city">("southtowns");
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
        if (event.region !== activeRegion) return false;
        if (event.distance > maxDistance) return false;
        if (showClippings && !saved.includes(event.id)) return false;
        if (activeFilter !== "All" && !event.categories.includes(activeFilter)) return false;
        if (activeDay !== "All week" && !(event.days ?? [event.day]).includes(activeDay)) return false;
        return true;
      }),
    [activeDay, activeFilter, activeRegion, maxDistance, saved, showClippings],
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
            <span>Morning edition · Wednesday, August 12, 2026</span>
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
            Five family plans today <i>◆</i> Southtowns-first desk <i>◆</i> Buffalo city picks in their own tab
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
              <p className="section-kicker">Top pick · Southtowns desk</p>
              <h2>The fair is the family outing that earns a full day.</h2>
              <p className="drop-cap">
                Six miles from home, the Erie County Fair opens today with the rare all-ages mix: little kids can meet farm animals, bigger kids get the midway, and adults can make a highly defensible lunch out of fried dough. Bring four non-perishable items per person for opening-day admission.
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
                <button onClick={() => toggleSaved("erie-fair-today")} className="clip-button">
                  {saved.includes("erie-fair-today") ? "✓ Clipped" : "+ Clip this pick"}
                </button>
              </div>
            </div>
          </article>

          <aside className="editor-note">
            <p className="section-kicker">From the family desk</p>
            <h2>A fair day. Fossils close by.</h2>
            <p>
              Today’s short list keeps four picks in the Southtowns, with one city standout for dinosaur fans. Most are free or standard library programs.
            </p>
            <div className="mini-ranking">
              <div><span>01</span><p><b>Best all-day plan</b> Destination Dinosaur at the zoo</p></div>
              <div><span>02</span><p><b>Closest plan</b> Reptiles Around the World, one mile away</p></div>
              <div><span>03</span><p><b>Best hands-on plan</b> Fossil Frenzy in Elma</p></div>
            </div>
            <button onClick={surpriseMe} className="surprise-button">✦ Let the presses pick</button>
            <p className="weather-caution">Times, weather and availability can change. Open the source before leaving.</p>
          </aside>
        </section>

        <section id="today" className="today-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Wednesday’s morning edition</p>
              <h2>Today</h2>
            </div>
            <p>Four Southtowns picks, plus one city standout, from first story to final credits.</p>
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
            <p>Southtowns is the default desk. Switch tabs for Buffalo city events; your clippings stay on this device.</p>
          </div>

          <div className="filter-desk" aria-label="Event filters">
            <div className="region-tabs" role="tablist" aria-label="Where to go">
              <button className={activeRegion === "southtowns" ? "region-tab active" : "region-tab"} onClick={() => setActiveRegion("southtowns")} aria-selected={activeRegion === "southtowns"} role="tab">
                Southtowns first
              </button>
              <button className={activeRegion === "city" ? "region-tab active" : "region-tab"} onClick={() => setActiveRegion("city")} aria-selected={activeRegion === "city"} role="tab">
                Buffalo city
              </button>
            </div>
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
              <span className="result-count">{visibleWeek.length} {visibleWeek.length === 1 ? "story" : "stories"} · {activeRegion === "southtowns" ? "Southtowns desk" : "city desk"}</span>
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
                <button onClick={() => { setActiveRegion("southtowns"); setActiveFilter("All"); setActiveDay("All week"); setMaxDistance(25); setShowClippings(false); }}>
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
