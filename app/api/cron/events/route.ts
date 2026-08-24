import { POST as refreshEvents } from "../../events/route";

export const maxDuration = 30;

/** Vercel Cron invokes GET; the events route keeps the refresh implementation private behind CRON_SECRET. */
export async function GET(request: Request) {
  return refreshEvents(request);
}
