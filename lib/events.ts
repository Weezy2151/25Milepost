import { z } from "zod";

export const AREAS = ["southtowns", "city"] as const;
export const EVENT_KINDS = [
  "Fairs & festivals",
  "Markets & food",
  "Live music",
  "Sports & active",
  "Outdoors",
  "Museums & culture",
  "Community",
  "Library",
] as const;
export const EVENT_SETTINGS = ["indoor", "outdoor", "both"] as const;
export const DISTANCE_PRECISIONS = ["venue", "town", "region"] as const;

export const areaSchema = z.enum(AREAS);
export const eventKindSchema = z.enum(EVENT_KINDS);
export const eventSettingSchema = z.enum(EVENT_SETTINGS);
export const distancePrecisionSchema = z.enum(DISTANCE_PRECISIONS);
const webUrlSchema = z.url().refine((value) => /^https?:\/\//i.test(value), "Expected an HTTP(S) URL");
const imageUrlSchema = z.string().refine((value) => value.startsWith("/") || /^https:\/\//i.test(value), "Expected a local or HTTPS image URL");

/** The normalized event contract shared by the API, cache, and live client. */
export const liveEventSchema = z.object({
  id: z.string().min(1).max(240),
  area: areaSchema,
  town: z.string().min(1).max(160),
  day: z.string().min(1).max(32),
  date: z.string().min(1).max(96),
  dateKey: z.iso.date(),
  time: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  venue: z.string().min(1).max(300),
  distance: z.number().finite().min(0).max(100),
  description: z.string().max(1_000),
  cost: z.string().max(240),
  source: z.string().min(1).max(160),
  url: webUrlSchema.or(z.literal("")),
  mapUrl: webUrlSchema,
  tags: z.array(z.string().min(1).max(100)).max(20),
  accent: z.string().min(1).max(32),
  image: imageUrlSchema.optional(),
  today: z.boolean().optional(),
  kind: eventKindSchema,
  setting: eventSettingSchema,
  priority: z.number().finite().min(0).max(100),
  lat: z.number().finite().min(-90).max(90),
  lon: z.number().finite().min(-180).max(180),
  distancePrecision: distancePrecisionSchema,
});

export type Area = z.infer<typeof areaSchema>;
export type EventKind = z.infer<typeof eventKindSchema>;
export type EventSetting = z.infer<typeof eventSettingSchema>;
export type DistancePrecision = z.infer<typeof distancePrecisionSchema>;
export type LiveEvent = z.infer<typeof liveEventSchema>;

export const freshnessSchema = z.object({
  state: z.enum(["fresh", "stale", "last-good"]),
  ageSeconds: z.number().finite().nonnegative(),
  builtFor: z.iso.date(),
  store: z.string().min(1),
});

export const sourceHealthSchema = z.object({
  name: z.string().min(1),
  ok: z.boolean(),
  count: z.number().int().nonnegative().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  error: z.string().max(500).optional(),
});

export const eventsPayloadSchema = z.object({
  events: z.array(liveEventSchema),
  count: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
  window: z.object({ from: z.iso.date(), to: z.iso.date() }),
  sources: z.array(sourceHealthSchema),
  mix: z.record(z.string(), z.number().int().nonnegative()),
  freshness: freshnessSchema,
});

export type Freshness = z.infer<typeof freshnessSchema>;
export type SourceHealth = z.infer<typeof sourceHealthSchema>;
export type EventsPayload = z.infer<typeof eventsPayloadSchema>;

/** Parse untrusted JSON without letting one malformed event crash the page. */
export function parseEventsPayload(value: unknown): EventsPayload | null {
  const parsed = eventsPayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseStoredIds(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = z.array(z.string().min(1).max(240)).max(500).safeParse(JSON.parse(value));
    return parsed.success ? [...new Set(parsed.data)] : [];
  } catch {
    return [];
  }
}

export const storedPlanItemSchema = z.object({ id: z.string().min(1).max(240), title: z.string().min(1).max(300) });
export type StoredPlanItem = z.infer<typeof storedPlanItemSchema>;

/** Read the v2 itinerary format and migrate the previous array of full events. */
export function parseStoredPlan(value: string | null): StoredPlanItem[] {
  if (!value) return [];
  try {
    const json: unknown = JSON.parse(value);
    const current = z.object({ version: z.literal(2), items: z.array(storedPlanItemSchema).max(100) }).safeParse(json);
    if (current.success) return current.data.items;
    const legacy = z.array(storedPlanItemSchema.passthrough()).max(100).safeParse(json);
    return legacy.success ? legacy.data.map(({ id, title }) => ({ id, title })) : [];
  } catch {
    return [];
  }
}
