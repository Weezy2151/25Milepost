/**
 * schema.org structured data for the listings.
 *
 * This is what earns a place in Google's event results, which for a hyperlocal
 * guide is the distribution channel — someone searching "orchard park farmers
 * market this weekend" should find the page that answers it. It is only
 * possible now that events carry real start times.
 *
 * Only what is actually known is emitted. A listing with no readable clock
 * gets a date and no time rather than an invented midnight, and an event whose
 * price cannot be read carries no offer rather than a guessed one.
 */

import { eventMinutes, isFree, type EventPick } from "./filter.ts";

/** Minutes past midnight as the local-time portion of an ISO 8601 string. */
function isoTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
}

/**
 * One event as a schema.org Event.
 *
 * Times are written without a zone offset. That is deliberate: the app knows
 * the local wall-clock time, and a local time is what a reader wants; guessing
 * an offset would mean guessing whether the date falls in daylight saving.
 */
export function eventJsonLd(event: EventPick, siteUrl: string) {
  const { startMinutes, endMinutes } = eventMinutes(event);
  const date = event.dateKey;

  const data: Record<string, unknown> = {
    "@type": "Event",
    name: event.title,
    startDate: date && startMinutes !== null ? `${date}T${isoTime(startMinutes)}` : date,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: event.venue,
      address: { "@type": "PostalAddress", addressLocality: event.town, addressRegion: "NY", addressCountry: "US" },
      ...(event.lat !== undefined && event.lon !== undefined
        ? { geo: { "@type": "GeoCoordinates", latitude: event.lat, longitude: event.lon } }
        : {}),
    },
    url: event.url || `${siteUrl}/#event-${encodeURIComponent(event.id)}`,
  };

  if (date && endMinutes !== null) data.endDate = `${date}T${isoTime(endMinutes)}`;
  if (event.description) data.description = event.description;
  if (event.image) data.image = event.image;

  // Only a listing that is plainly free can be described as costing nothing;
  // every other price string is prose, not a number.
  if (isFree(event.cost)) {
    data.offers = {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      ...(event.url ? { url: event.url } : {}),
    };
  }

  if (event.source) data.organizer = { "@type": "Organization", name: event.source };

  return data;
}

/**
 * The whole day as one JSON-LD graph.
 *
 * @param events Events for the day being rendered.
 * @param siteUrl Absolute site origin, for links back to individual events.
 */
export function eventsJsonLd(events: EventPick[], siteUrl: string, limit = 25) {
  return {
    "@context": "https://schema.org",
    "@graph": events.slice(0, limit).map((event) => eventJsonLd(event, siteUrl)),
  };
}
