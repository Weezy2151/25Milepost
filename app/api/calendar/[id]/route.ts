import { readCachedEventsPayload } from "../../../../lib/events-cache";
import { buildIcs } from "../../../../lib/ics-write";
import { siteOrigin } from "../../../../lib/site";
import { zonedTodayKey } from "../../../../lib/time";

/**
 * One event as a calendar file.
 *
 * Served from the cached payload rather than rebuilt: a calendar download must
 * never be what pays for a dozen live feed fetches. An event that is no longer
 * in the current listings is a 404 — better than handing someone a file for
 * something that may not be happening.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await readCachedEventsPayload(zonedTodayKey());
  const event = payload?.events.find((candidate) => candidate.id === id);

  if (!event) {
    return new Response("Event not found in the current listings", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const ics = buildIcs([event], { siteOrigin, name: event.title });
  // The filename is derived from the event id, which is already slug-shaped.
  const filename = `${id.replace(/[^a-z0-9-]+/gi, "-").slice(0, 60) || "event"}.ics`;

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
