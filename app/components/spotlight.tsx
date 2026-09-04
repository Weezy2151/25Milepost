"use client";

import { isFree, type EventPick } from "../../lib/filter";
import { IconSparkle } from "./icons";

/** The three handpicked events shown above an unfiltered list. */
export function Spotlight({ spotlight, onOpen }: { spotlight: EventPick[]; onOpen: (event: EventPick) => void }) {
  return (
    <section className="wrap section" aria-label="Best bets near you">
      <div className="section-head">
        <div>
          <p className="eyebrow">Handpicked highlights</p>
          <h2 className="display">Best bets near you</h2>
        </div>
        <p className="count">The three we&rsquo;d pick first this week</p>
      </div>
      <div className="spot-grid">
        {spotlight.map((event, index) => (
          <button key={event.id} type="button" className="spot" onClick={() => onOpen(event)}>
            <span className="spot-rank">
              <IconSparkle style={{ width: 13, height: 13 }} />
              {index === 0 ? "Featured pick" : index === 1 ? "Family favorite" : "Local highlight"}
            </span>
            <h3>{event.title}</h3>
            <p>{event.description}</p>
            <span className="spot-foot">
              <span>
                {event.town} · {event.distance} mi
              </span>
              <span className={isFree(event.cost) ? "free" : ""} style={isFree(event.cost) ? { color: "var(--good)" } : undefined}>
                {event.cost.length > 26 ? `${event.cost.slice(0, 26)}…` : event.cost}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
