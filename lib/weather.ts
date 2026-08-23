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
