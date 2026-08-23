import { z } from "zod";

import { sourceHealthSchema } from "./events";

export const EVENTS_HEALTH_KEY = "events:balanced-v4:health";

export const healthSnapshotSchema = z.object({
  checkedAt: z.iso.datetime(),
  builtFor: z.iso.date(),
  healthy: z.boolean(),
  sources: z.array(sourceHealthSchema.extend({
    lastSuccessAt: z.iso.datetime().optional(),
    consecutiveFailures: z.number().int().nonnegative(),
  })),
});

export type HealthSnapshot = z.infer<typeof healthSnapshotSchema>;
