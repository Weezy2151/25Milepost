import { readCachedEventsPayload } from "../../../../lib/events-cache";
import { buildIcs } from "../../../../lib/ics-write";
import { siteOrigin } from "../../../../lib/site";
import { zonedTodayKey } from "../../../../lib/time";

/** More stops than anyone plans in a day; a guard against a very long URL. */
const MAX_STOPS = 25;

/**
 * A whole itinerary as one calendar file.
 *
 * My Day lives in the visitor's own browser, so the ids come in on the query
 * string. Anything not in the current listings is skipped rather than failing
 * the download — a plan with one stale stop is still worth exporting.
 */
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.getAll("id").slice(0, MAX_STOPS);
  if (ids.length === 0) {
    return new Response("No events requested", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const payload = await readCachedEventsPayload(zonedTodayKey());
  const byId = new Map((payload?.events ?? []).map((event) => [event.id, event]));
  const events = ids.flatMap((id) => byId.get(id) ?? []);

  if (events.length === 0) {
    return new Response("None of those events are in the current listings", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(buildIcs(events, { siteOrigin, name: "My Day · The 25-Mile Post" }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-day.ics"',
      "Cache-Control": "no-store",
    },
  });
}
