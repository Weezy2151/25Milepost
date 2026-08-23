import { cacheBackendName, getCachedEntry } from "../../../db/cache";
import { EVENTS_HEALTH_KEY, healthSnapshotSchema } from "../../../lib/health";

export async function GET() {
  const entry = await getCachedEntry<unknown>(EVENTS_HEALTH_KEY);
  const parsed = healthSnapshotSchema.safeParse(entry?.data);
  if (!entry || !parsed.success) {
    return Response.json({ healthy: false, store: cacheBackendName(), error: "No source health snapshot is available" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const failed = parsed.data.sources.filter((source) => !source.ok);
  const status = parsed.data.healthy && failed.every((source) => source.consecutiveFailures < 3) ? 200 : 503;
  return Response.json({ ...parsed.data, store: cacheBackendName() }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
