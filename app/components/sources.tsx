"use client";

import { IconChevron, IconExternal } from "./icons";

/**
 * Calendars the API actually pulls on each refresh — keep in step with
 * LIBRARY_FEEDS / TRIBE_FEEDS / ICS_FEEDS in app/api/events/route.ts.
 */
export const FETCHED_SOURCES: Array<[string, string]> = [
  ["Buffalo & Erie County Public Library", "https://www.buffalolib.org/"],
  ["EverythingOP", "https://everythingop.com/events/"],
  ["Orchard Park Chamber", "https://orchardparkchamber.org/events/"],
  ["Buffalo Rising", "https://www.buffalorising.com/events/"],
  ["Visit Buffalo", "https://visitbuffalo.com/events/"],
  ["Town of Orchard Park", "https://www.orchardparkny.gov/events/"],
  ["Town of Evans", "https://townofevansny.gov/events/"],
  ["Southtowns Regional Chamber", "https://southtownsregionalchamber.org/news-events/"],
  ["Explore & More", "https://exploreandmore.org/events/"],
  ["Erie County Parks", "https://www3.erie.gov/parks/events"],
  ["Step Out Buffalo", "https://stepoutbuffalo.com/all-events/"],
  ["East Aurora Chamber", "https://business.eanycc.com/eventcalendar"],
];

/**
 * Publishers with no usable feed. These are read by a person and turned into
 * the curated entries in the API route, so they are listed separately rather
 * than implying the app scrapes them.
 */
export const MANUAL_SOURCES: Array<[string, string]> = [
  ["Visit Buffalo Niagara", "https://visitbuffalo.com/events/"],
  ["Village of Hamburg", "https://villageofhamburgny.gov/events"],
  ["Village of East Aurora", "https://www.eastaurora.gov/news-updates-events/calendar-of-events"],
  ["WNY Family Magazine", "https://www.wnyfamilymagazine.com/search/event/calendar-of-events/index.html"],
  ["Orchard Park Bee", "https://www.orchardparkbee.com/"],
  ["Hamburg Sun", "https://www.sun-news.com/"],
];

/** Where the listings come from, disclosed openly at the foot of the page. */
export function Sources() {
  return (
    <div className="wrap">
      <details className="sources">
        <summary>
          <IconChevron />
          Where we look · {FETCHED_SOURCES.length} live feeds
          <span className="rule" />
        </summary>
        <div className="source-grid">
          <div className="source-col">
            <h3>Fetched every morning</h3>
            {FETCHED_SOURCES.map(([label, href]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer">
                {label}
                <IconExternal />
              </a>
            ))}
          </div>
          <div className="source-col">
            <h3>Checked by hand</h3>
            {MANUAL_SOURCES.map(([label, href]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer">
                {label}
                <IconExternal />
              </a>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
