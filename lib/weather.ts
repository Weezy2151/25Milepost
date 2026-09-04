import { z } from "zod";

export const dayForecastSchema = z.object({
  dateKey: z.iso.date(),
  label: z.string(),
  high: z.number().finite(),
  low: z.number().finite(),
  rain: z.number().finite().min(0).max(100),
  code: z.number().int(),
});

export const weatherSchema = z.object({
  label: z.string(),
  now: z.number().finite(),
  high: z.number().finite(),
  rain: z.number().finite().min(0).max(100),
  days: z.array(dayForecastSchema).min(1).max(8),
  updatedAt: z.iso.datetime(),
});

export type DayForecast = z.infer<typeof dayForecastSchema>;
export type Weather = z.infer<typeof weatherSchema>;

/**
 * WMO weather code → the emoji the cards and day tiles show.
 *
 * Lives with the forecast types rather than in a component so the day picker,
 * the event cards and the hero all read the same sky from one place.
 */
export function weatherEmoji(code: number) {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67 || (code >= 80 && code <= 82)) return "🌧️";
  if (code <= 77) return "❄️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}
