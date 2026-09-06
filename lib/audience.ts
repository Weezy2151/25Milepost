/**
 * Who an event is actually for.
 *
 * "Is this good for a three-year-old?" used to be answered in the browser by a
 * regex over the card text, which is why a brewery's "family table" matched and
 * a library lap-sit did not. Sources know the answer and say so — LibCal
 * publishes a real audience list per program, The Events Calendar carries
 * categories, Erie County Parks labels its "Kids & Families" listings — so the
 * server resolves it once, here, and the page reads a field instead of guessing.
 */

export const EVENT_AUDIENCES = ["toddler", "kids", "teen", "family"] as const;

export type EventAudience = (typeof EVENT_AUDIENCES)[number];

/**
 * An explicit age gate anywhere in the text disqualifies every child audience,
 * however family-sounding the rest of the listing is. Kept in sync with the
 * route's own AGE_GATED guard, which decides whether the event is carried at all.
 */
const ADULTS_ONLY = /\b(?:21\+|18\+|adults? only|adult only|ages 21|must be 21)\b/;

/**
 * Source-supplied labels, which outrank anything inferred from prose.
 * LibCal's own vocabulary is the bulk of this: "Babies (0-2)", "Toddlers
 * (2-3)", "Preschoolers", "Children (6-11)", "Tweens", "Teens", "Adults",
 * "All Ages", "Families".
 */
const LABEL_RULES: Array<[RegExp, EventAudience]> = [
  [/\b(?:babies|baby|infant|toddlers?|preschool|pre-?k|early childhood|ages? 0|0-2|2-3|3-5)\b/, "toddler"],
  [/\b(?:children|child|kids?|elementary|school ?age|grades? k|6-11|5-12)\b/, "kids"],
  [/\b(?:teens?|tweens?|young adults?|grades? 6|middle school|high school)\b/, "teen"],
  [/\b(?:famil(?:y|ies)|all ages|intergenerational)\b/, "family"],
];

/** Prose fallback, for the many sources that publish no audience label at all. */
const TEXT_RULES: Array<[RegExp, EventAudience]> = [
  [
    /\b(?:story ?times?|story ?hour|lap ?sit|baby|babies|toddlers?|preschool|pre-?k|little ones|tiny tots|caregivers?|stroller|sensory[- ]friendly|open play|play ?caf|music together|wiggle|mother goose|rhyme time|petting zoo|splash pad)\b/,
    "toddler",
  ],
  [
    /\b(?:kids?|children|childrens?|youth|lego|craft|slime|pokemon|minecraft|scavenger hunt|puppet|magic show|face painting|story ?walk|bounce house|playground|junior|read to a dog|kids? day)\b/,
    "kids",
  ],
  [/\b(?:teens?|tweens?|anime|manga|dungeons ?& ?dragons|d& ?d|esports)\b/, "teen"],
  [/\b(?:famil(?:y|ies)|all[- ]ages|family[- ]friendly)\b/, "family"],
];

/**
 * Resolve the audiences for one listing.
 *
 * `labels` is whatever structured vocabulary the source provided — LibCal
 * audiences, Events Calendar categories, Ticketmaster genres, a scraped
 * category. It is checked first and, when it produces a hit, the prose pass is
 * still run to fill in what the label set omits; sources routinely tag a
 * storytime "Children" without ever saying "Preschool".
 */
export function deriveAudiences(title: string, description = "", labels: string[] = []): EventAudience[] {
  const labelText = labels.join(" ").toLowerCase();
  const prose = `${title} ${description}`.toLowerCase();
  if (ADULTS_ONLY.test(`${prose} ${labelText}`)) return [];

  const found = new Set<EventAudience>();
  for (const [pattern, audience] of LABEL_RULES) if (pattern.test(labelText)) found.add(audience);
  for (const [pattern, audience] of TEXT_RULES) if (pattern.test(prose)) found.add(audience);

  // "Family" alongside a specific age band is noise — the band is the useful
  // answer. It stays on its own for events that are genuinely just all-ages.
  if (found.size > 1) found.delete("family");

  return EVENT_AUDIENCES.filter((audience) => found.has(audience));
}

/**
 * How strongly a listing reads as young-kid programming, for ranking rather
 * than filtering. Used where a source offers more than a day can show and the
 * closest toddler option should win the slot.
 */
export function kidScore(audiences: readonly EventAudience[]) {
  let score = 0;
  if (audiences.includes("toddler")) score += 3;
  if (audiences.includes("kids")) score += 2;
  if (audiences.includes("family")) score += 1;
  return score;
}
