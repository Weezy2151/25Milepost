/**
 * Venue geography for The 25-Mile Post.
 *
 * Distance used to be a single hardcoded number per town, so every venue in
 * Hamburg was "8 miles" whether it was the fairgrounds or the far edge of town.
 * This resolves real coordinates — venue-level where we know the place,
 * town-centroid otherwise — and measures great-circle distance from Orchard Park.
 */

export type Coords = { lat: number; lon: number };
export type Precision = "venue" | "town" | "region";

/** Central Orchard Park — the same point the forecast is pulled for. */
export const ORIGIN: Coords = { lat: 42.7676, lon: -78.7439 };

/** Fallback when a town is unknown: roughly the middle of the Southtowns. */
const REGION_FALLBACK: Coords = { lat: 42.8, lon: -78.82 };

/**
 * When we cannot place an event at all, claim the outer edge of the radius
 * rather than a flattering guess — better to under-promise on "5 miles away".
 */
const UNKNOWN_DISTANCE = 18;

const TOWNS: Record<string, Coords> = {
  "orchard park": { lat: 42.7676, lon: -78.7439 },
  hamburg: { lat: 42.7159, lon: -78.8295 },
  "west seneca": { lat: 42.85, lon: -78.7998 },
  eden: { lat: 42.6531, lon: -78.8956 },
  elma: { lat: 42.8237, lon: -78.635 },
  boston: { lat: 42.6273, lon: -78.7381 },
  blasdell: { lat: 42.7967, lon: -78.8261 },
  lackawanna: { lat: 42.8256, lon: -78.8234 },
  "east aurora": { lat: 42.7681, lon: -78.6131 },
  aurora: { lat: 42.7681, lon: -78.6131 },
  lancaster: { lat: 42.9006, lon: -78.6703 },
  "south buffalo": { lat: 42.8467, lon: -78.81 },
  buffalo: { lat: 42.8864, lon: -78.8784 },
  lakeshore: { lat: 42.718, lon: -78.906 },
  "lake shore": { lat: 42.718, lon: -78.906 },
  cheektowaga: { lat: 42.9034, lon: -78.7548 },
  marilla: { lat: 42.8306, lon: -78.5561 },
  evans: { lat: 42.6395, lon: -79.0287 },
  angola: { lat: 42.6381, lon: -79.0281 },
  derby: { lat: 42.6892, lon: -78.9803 },
  depew: { lat: 42.9042, lon: -78.6928 },
  alden: { lat: 42.902, lon: -78.4939 },
  springville: { lat: 42.5089, lon: -78.6672 },
  "north collins": { lat: 42.5942, lon: -78.9364 },
  colden: { lat: 42.657, lon: -78.672 },
  holland: { lat: 42.64, lon: -78.54 },
  wales: { lat: 42.75, lon: -78.53 },
  sardinia: { lat: 42.53, lon: -78.51 },
  concord: { lat: 42.51, lon: -78.69 },
  tonawanda: { lat: 42.9967, lon: -78.8803 },
  amherst: { lat: 42.9784, lon: -78.7998 },
  clarence: { lat: 43.0037, lon: -78.5975 },
  williamsville: { lat: 42.9639, lon: -78.7378 },
  kenmore: { lat: 42.9656, lon: -78.87 },
  "grand island": { lat: 43.0334, lon: -78.9622 },
};

/**
 * Known venues, keyed by a normalised name. Matching is exact-then-substring,
 * so "Hamburg Public Library · 102 Buffalo St" still resolves to the library.
 */
const VENUES: Record<string, Coords> = {
  // Southtowns anchors
  "highmark stadium": { lat: 42.7738, lon: -78.787 },
  "hamburg fairgrounds": { lat: 42.7247, lon: -78.8264 },
  "erie county fairgrounds": { lat: 42.7247, lon: -78.8264 },
  "orchard park public library": { lat: 42.7674, lon: -78.7436 },
  "hamburg public library": { lat: 42.7166, lon: -78.8296 },
  "lake shore branch library": { lat: 42.718, lon: -78.906 },
  "eden library": { lat: 42.6537, lon: -78.8968 },
  "elma public library": { lat: 42.823, lon: -78.6353 },
  "west seneca public library": { lat: 42.833, lon: -78.755 },
  "lackawanna public library": { lat: 42.8262, lon: -78.8236 },
  "boston free library": { lat: 42.6289, lon: -78.7382 },
  "aurora town public library": { lat: 42.7683, lon: -78.613 },
  "marilla free library": { lat: 42.8306, lon: -78.5561 },
  "lancaster public library": { lat: 42.901, lon: -78.6706 },
  "anna reinstein memorial library": { lat: 42.9047, lon: -78.7511 },
  "julia boyer reinstein library": { lat: 42.927, lon: -78.718 },
  "orchard park train depot": { lat: 42.766, lon: -78.745 },
  "orchard park br&p depot": { lat: 42.766, lon: -78.745 },
  "orchard park depot": { lat: 42.766, lon: -78.745 },
  "hamburg memorial park": { lat: 42.7169, lon: -78.834 },
  "west seneca town center": { lat: 42.833, lon: -78.7549 },
  "chestnut ridge park": { lat: 42.7361, lon: -78.7519 },
  "knox farm state park": { lat: 42.7845, lon: -78.6289 },
  "eighteen mile creek": { lat: 42.7156, lon: -78.9231 },

  // City anchors
  "central library": { lat: 42.8853, lon: -78.8737 },
  "buffalo zoo": { lat: 42.9377, lon: -78.8483 },
  canalside: { lat: 42.877, lon: -78.8797 },
  "sahlen field": { lat: 42.8802, lon: -78.8737 },
  "delaware park": { lat: 42.9345, lon: -78.8563 },
  "shakespeare hill": { lat: 42.9345, lon: -78.8563 },
  "explore & more": { lat: 42.8776, lon: -78.8783 },
  "explore and more": { lat: 42.8776, lon: -78.8783 },
  "prospect park": { lat: 42.8967, lon: -78.8886 },
  "cazenovia park": { lat: 42.848, lon: -78.806 },
  "martin luther king jr park": { lat: 42.9018, lon: -78.8449 },
  "buffalo history museum": { lat: 42.9327, lon: -78.8697 },
  "albright-knox": { lat: 42.9331, lon: -78.8763 },
  "buffalo museum of science": { lat: 42.9022, lon: -78.8452 },
  "riverworks": { lat: 42.8712, lon: -78.8875 },
  "outer harbor": { lat: 42.8563, lon: -78.8859 },
  "larkin square": { lat: 42.8748, lon: -78.8547 },
};

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[·|,]/g, " ")
    .replace(/[^a-z0-9& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupTown(town: string): Coords | null {
  const key = normalise(town);
  if (TOWNS[key]) return TOWNS[key];
  // "Hamburg Village" / "Town of Hamburg" still point at Hamburg.
  for (const [name, coords] of Object.entries(TOWNS)) {
    if (key.includes(name)) return coords;
  }
  return null;
}

function lookupVenue(venue: string): Coords | null {
  const key = normalise(venue);
  if (!key) return null;
  if (VENUES[key]) return VENUES[key];
  for (const [name, coords] of Object.entries(VENUES)) {
    if (key.includes(name)) return coords;
  }
  return null;
}

/** Great-circle distance in statute miles. */
export function haversineMiles(a: Coords, b: Coords) {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Straight-line miles under-state a drive. Roads in Erie County are close to a
 * grid, so a small multiplier tracks real driving distance far better than the
 * old per-town constant without needing a routing API.
 */
const ROAD_FACTOR = 1.22;

export function drivingMiles(from: Coords, to: Coords) {
  const miles = haversineMiles(from, to) * ROAD_FACTOR;
  // Anything in your own village reads as "1 mi" rather than "0 mi".
  return Math.max(1, Math.round(miles));
}

export type Located = { coords: Coords; precision: Precision };

/** Best-known coordinates for a venue, falling back to town then region. */
export function locate(venue: string, town: string): Located {
  const atVenue = lookupVenue(venue);
  if (atVenue) return { coords: atVenue, precision: "venue" };

  const atTown = lookupTown(town) ?? lookupTown(venue);
  if (atTown) return { coords: atTown, precision: "town" };

  return { coords: REGION_FALLBACK, precision: "region" };
}

/** Distance from central Orchard Park, with the precision we managed to reach. */
export function distanceFromOrigin(venue: string, town: string) {
  const located = locate(venue, town);
  return {
    ...located,
    distance: located.precision === "region" ? UNKNOWN_DISTANCE : drivingMiles(ORIGIN, located.coords),
  };
}
