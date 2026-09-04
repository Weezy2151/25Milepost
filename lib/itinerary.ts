/**
 * Turning a list of saved stops into an actual plan for the day.
 *
 * My Day was a list in the order things were added: no times, no sense of
 * whether two stops clash, no idea how long it takes to get from one to the
 * next. With real start times on every event, it can be an itinerary.
 *
 * Nothing here guesses. Travel time is only offered between two stops that
 * both carry coordinates, because the alternative — subtracting their
 * distances from Orchard Park — would call two events ten miles away in
 * opposite directions neighbours.
 */

import { driveMinutes, eventMinutes, type EventPick } from "./filter.ts";
import { drivingMiles } from "./geo.ts";

export type Stop = {
  event: EventPick;
  /** Always known: an event with no readable time is unscheduled instead. */
  startMinutes: number;
  endMinutes: number | null;
  /** Overlaps the stop before it in the plan. */
  clashes: boolean;
  /** Driving miles and minutes from the previous stop, when both are located. */
  travel: { miles: number; minutes: number } | null;
  /**
   * True when the previous stop ends after you would need to leave to reach
   * this one on time.
   */
  tight: boolean;
};

export type Itinerary = {
  /** Stops with a known start, in the order the day happens. */
  stops: Stop[];
  /** Saved events with no readable time, which cannot be placed in the day. */
  unscheduled: EventPick[];
  /** Stops that are no longer in the current listings. */
  clashCount: number;
};

function coordsOf(event: EventPick) {
  return event.lat !== undefined && event.lon !== undefined ? { lat: event.lat, lon: event.lon } : null;
}

export function buildItinerary(events: EventPick[]): Itinerary {
  const timed: { event: EventPick; startMinutes: number; endMinutes: number | null }[] = [];
  const unscheduled: EventPick[] = [];

  for (const event of events) {
    const { startMinutes, endMinutes } = eventMinutes(event);
    if (startMinutes === null) unscheduled.push(event);
    else timed.push({ event, startMinutes, endMinutes });
  }

  timed.sort((a, b) => a.startMinutes - b.startMinutes);

  let clashCount = 0;
  const stops: Stop[] = timed.map((entry, index) => {
    const previous = timed[index - 1];
    let clashes = false;
    let travel: Stop["travel"] = null;
    let tight = false;

    if (previous) {
      // Without a stated end, a stop is assumed to run until the next one —
      // so only a genuinely known end can prove a clash.
      clashes = previous.endMinutes !== null && previous.endMinutes > entry.startMinutes;
      if (clashes) clashCount += 1;

      const from = coordsOf(previous.event);
      const to = coordsOf(entry.event);
      if (from && to) {
        const miles = Math.round(drivingMiles(from, to));
        travel = { miles, minutes: driveMinutes(miles) };
        // Leaving when the previous stop ends, is there time to arrive?
        const leaveAt = previous.endMinutes ?? previous.startMinutes;
        tight = !clashes && leaveAt + travel.minutes > entry.startMinutes;
      }
    }

    return { event: entry.event, startMinutes: entry.startMinutes, endMinutes: entry.endMinutes, clashes, travel, tight };
  });

  return { stops, unscheduled, clashCount };
}

/**
 * A Google Maps route through every stop.
 *
 * Origin is Orchard Park, since that is where the guide measures from and
 * where most of its readers are starting.
 */
export function routeUrl(events: EventPick[], origin = "Orchard Park, NY") {
  const stops = events.map((event) => `${event.venue}, ${event.town}, NY`);
  if (stops.length === 0) return null;

  const params = new URLSearchParams({
    api: "1",
    origin,
    destination: stops[stops.length - 1],
    travelmode: "driving",
  });
  // Everything between the first and last stop is a waypoint.
  const waypoints = stops.slice(0, -1);
  if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
