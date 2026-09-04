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

/**
 * The one thing worth saying about a day's weather before someone makes plans.
 *
 * Rain was the only condition the page ever mentioned, which is a thin reading
 * of the forecast in Western New York — a 12° January Saturday or a lake-effect
 * snow day changes an outdoor plan at least as decisively as a shower. Only the
 * most consequential advisory is returned, so the page never stacks warnings.
 *
 * Wind is not covered: the forecast request does not ask for it, and inventing
 * a wind chill from the fields we do have would be a guess.
 */
export type Advisory = {
  /** Identifies the rule, for tests and for styling. */
  kind: "storm" | "snow" | "cold" | "heat" | "rain";
  icon: string;
  headline: string;
  suggestion: string;
  /** Whether the advisory is a reason to look at indoor events. */
  suggestsIndoor: boolean;
};

export const RAIN_ADVISORY_PERCENT = 40;
const BITTER_COLD_HIGH = 20;
const HOT_HIGH = 88;

export function dayAdvisory(day: DayForecast | null): Advisory | null {
  if (!day) return null;

  if (day.code >= 95) {
    return {
      kind: "storm",
      icon: "⛈️",
      headline: "Thunderstorms possible",
      suggestion: "Outdoor events may be cut short — have somewhere indoors in mind.",
      suggestsIndoor: true,
    };
  }

  // WMO snow codes: steady snow and snow showers.
  if ((day.code >= 71 && day.code <= 77) || day.code === 85 || day.code === 86) {
    return {
      kind: "snow",
      icon: "❄️",
      headline: "Snow expected",
      suggestion: "Check before you drive, and give the Southtowns roads extra time.",
      suggestsIndoor: true,
    };
  }

  if (day.high <= BITTER_COLD_HIGH) {
    return {
      kind: "cold",
      icon: "🧣",
      headline: `Bitter cold — high of ${day.high}°`,
      suggestion: "Short outdoor stops only. Libraries, museums and play cafés stay warm.",
      suggestsIndoor: true,
    };
  }

  if (day.high >= HOT_HIGH) {
    return {
      kind: "heat",
      icon: "🥵",
      headline: `Hot — high of ${day.high}°`,
      suggestion: "Bring water and plan the outdoor part for the morning or evening.",
      suggestsIndoor: false,
    };
  }

  if (day.rain >= RAIN_ADVISORY_PERCENT) {
    return {
      kind: "rain",
      icon: "🌧️",
      headline: `${day.rain}% chance of rain`,
      suggestion: "Good weather for libraries, museums, play cafés and indoor games.",
      suggestsIndoor: true,
    };
  }

  return null;
}
