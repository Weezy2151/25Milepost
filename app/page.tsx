import { readCachedEventsPayload } from "../lib/events-cache";
import { zonedTodayKey } from "../lib/time";
import { eventsJsonLd } from "../lib/structured-data";
import { siteOrigin } from "../lib/site";
import { EventsClient } from "./events-client";

/**
 * The events page, server-rendered from whatever the cache already holds.
 *
 * The listings used to arrive only after the browser had booted React and
 * fetched them, which left the HTML empty — and for a hyperlocal guide, search
 * results are the distribution channel. Now the server hands over the same
 * cached payload the API would serve, and the client corrects it on mount.
 *
 * The read is deliberately cache-only. Building the payload means a dozen live
 * calendar fetches, and a page render must never be the thing that pays for
 * them: when the cache is cold this renders exactly the loading state it
 * always did, and the client's fetch does the building.
 */
export const revalidate = 900;

export default async function Home() {
  const todayKey = zonedTodayKey();
  const payload = await readCachedEventsPayload(todayKey);

  /*
   * Describe the day the page actually opens on.
   *
   * That is normally today, but the page lands on the first day that has
   * anything — on a quiet Monday with nothing until Wednesday, today's listing
   * is empty and Wednesday's is what a visitor sees. Describing "today" there
   * would mean shipping an empty graph on a page full of events, so this
   * mirrors the same fallback the client uses to choose its landing day.
   */
  const events = payload?.events ?? [];
  const landingDay =
    events.find((event) => event.dateKey === todayKey)?.dateKey
    ?? events.reduce<string | null>((earliest, event) => {
      if (!event.dateKey) return earliest;
      return earliest === null || event.dateKey < earliest ? event.dateKey : earliest;
    }, null);
  const shownEvents = landingDay ? events.filter((event) => event.dateKey === landingDay) : [];

  return (
    <>
      {shownEvents.length > 0 && (
        <script
          type="application/ld+json"
          // Serialised by us from validated data, never from user input.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(eventsJsonLd(shownEvents, siteOrigin)).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <EventsClient initialPayload={payload} />
    </>
  );
}
