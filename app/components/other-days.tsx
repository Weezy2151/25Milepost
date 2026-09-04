"use client";

import { isFree, type EventPick } from "../../lib/filter";
import { IconChevron, IconClock } from "./icons";

export type DayGroup = { dateKey: string; day: string; date: string; events: EventPick[] };

/**
 * Matches on days other than the one being viewed.
 *
 * The results list is deliberately one day at a time, which used to mean a
 * search for "storytime" on a day with none read as though the site had
 * nothing — even with four of them later in the week. This shows what the rest
 * of the week holds without leaving the day you are on.
 */
export function OtherDays({
  groups,
  total,
  onOpen,
  onJump,
}: {
  groups: DayGroup[];
  /** Matches across all other days, including those not listed here. */
  total: number;
  onOpen: (event: EventPick) => void;
  onJump: (dateKey: string) => void;
}) {
  return (
    <section className="otherdays" aria-label="Matches on other days">
      <div className="otherdays-head">
        <h3>
          {total} more {total === 1 ? "match" : "matches"} later this week
        </h3>
      </div>

      {groups.map((group) => (
        <div className="otherdays-group" key={group.dateKey}>
          <button type="button" className="otherdays-day" onClick={() => onJump(group.dateKey)}>
            {group.day === "TODAY" || group.day === "TOMORROW"
              ? group.day[0] + group.day.slice(1).toLowerCase()
              : group.day.slice(0, 3)}
            <span>{group.date}</span>
            <IconChevron />
          </button>

          <ul className="otherdays-list">
            {group.events.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => onOpen(event)}>
                  <span className="otherdays-title">{event.title}</span>
                  <span className="otherdays-meta">
                    <IconClock />
                    {event.time}
                    <i aria-hidden="true">·</i>
                    {event.town}
                    <i aria-hidden="true">·</i>
                    <b className={isFree(event.cost) ? "free" : undefined}>{isFree(event.cost) ? "Free" : event.cost}</b>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
