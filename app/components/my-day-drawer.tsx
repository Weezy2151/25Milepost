"use client";

import type { RefObject } from "react";

import type { StoredPlanItem } from "../../lib/client-data";
import type { EventPick } from "../../lib/filter";
import { buildItinerary, routeUrl } from "../../lib/itinerary";
import { formatMinutes } from "../../lib/time";
import { IconClock, IconCopy, IconPin, IconRoute, IconX } from "./icons";

/** The itinerary slide-over: the stops a visitor has lined up for their day. */
export function MyDayDrawer({
  planItems,
  plan,
  unavailablePlan,
  drawerRef,
  onClose,
  onRemove,
  onClear,
  onCopy,
}: {
  planItems: StoredPlanItem[];
  plan: EventPick[];
  unavailablePlan: StoredPlanItem[];
  drawerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRemove: (id: string, title: string) => void;
  onClear: () => void;
  onCopy: () => void;
}) {
  const planCount = planItems.length;
  // The plan becomes an actual day: ordered by time, with clashes and drives.
  const { stops, unscheduled, clashCount } = buildItinerary(plan);
  const route = routeUrl([...stops.map((stop) => stop.event), ...unscheduled]);
  const calendarHref = plan.length
    ? `/api/calendar/my-day?${plan.map((event) => `id=${encodeURIComponent(event.id)}`).join("&")}`
    : null;

  return (
      <div className="scrim">
        <button type="button" className="scrim-hit" onClick={onClose} aria-label="Close planner" />
        <aside className="drawer" role="dialog" aria-modal="true" aria-label="My Day planner" ref={drawerRef} tabIndex={-1}>
          <div className="drawer-top">
            <strong>My Day · {planCount} {planCount === 1 ? "stop" : "stops"}</strong>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close planner">
              <IconX />
            </button>
          </div>

          <div className="drawer-scroll">
            <div className="drawer-body">
              {planCount === 0 ? (
                <div className="empty">
                  <h3>Build your day</h3>
                  <p>
                    Tap the <strong>+</strong> on any event card to line up stops. Your itinerary stays on this device, so you can
                    close the tab and come back to it.
                  </p>
                  <button type="button" className="btn-solid" onClick={onClose}>
                    Browse events
                  </button>
                </div>
              ) : (
                <>
                  <div className="itin">
                    {stops.map((stop, index) => (
                      <div className="itin-row" key={stop.event.id}>
                        <div className="itin-rail">
                          <span className="itin-num">{index + 1}</span>
                          <span className="itin-line" />
                        </div>
                        <div className="itin-stop">
                          {/* What it takes to get here from the stop before. */}
                          {stop.travel && (
                            <p className={stop.tight ? "itin-travel tight" : "itin-travel"}>
                              <IconRoute />
                              {stop.travel.miles} mi · about {stop.travel.minutes} min from the last stop
                              {stop.tight && " — tight"}
                            </p>
                          )}
                          {stop.clashes && (
                            <p className="itin-travel clash">Overlaps the stop before it</p>
                          )}
                          <div className="itin-card">
                            <div style={{ minWidth: 0 }}>
                              <span className="itin-time">
                                {formatMinutes(stop.startMinutes)}
                                {stop.endMinutes !== null && ` – ${formatMinutes(stop.endMinutes)}`}
                              </span>
                              <h4>{stop.event.title}</h4>
                              <p>{stop.event.venue} · {stop.event.town} — {stop.event.distance} mi</p>
                            </div>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => onRemove(stop.event.id, stop.event.title)}
                              aria-label={`Remove ${stop.event.title} from My Day`}
                            >
                              <IconX />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Saved stops with no readable time cannot be placed in the day. */}
                    {unscheduled.map((event) => (
                      <div className="itin-row" key={event.id}>
                        <div className="itin-rail">
                          <span className="itin-num">·</span>
                          <span className="itin-line" />
                        </div>
                        <div className="itin-stop">
                          <div className="itin-card">
                            <div style={{ minWidth: 0 }}>
                              <span className="itin-time">{event.time}</span>
                              <h4>{event.title}</h4>
                              <p>{event.venue} · {event.town} — {event.distance} mi</p>
                            </div>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => onRemove(event.id, event.title)}
                              aria-label={`Remove ${event.title} from My Day`}
                            >
                              <IconX />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {unavailablePlan.map((item) => (
                      <div className="itin-row" key={item.id}>
                        <div className="itin-rail">
                          <span className="itin-num">·</span>
                          <span className="itin-line" />
                        </div>
                        <div className="itin-stop">
                          <div className="itin-card unavailable">
                            <div style={{ minWidth: 0 }}>
                              <span className="itin-time">Unavailable</span>
                              <h4>{item.title}</h4>
                              <p>This event is no longer in the current listings.</p>
                            </div>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => onRemove(item.id, item.title)}
                              aria-label={`Remove ${item.title} from My Day`}
                            >
                              <IconX />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="itin-summary">
                    {clashCount > 0
                      ? `${clashCount} ${clashCount === 1 ? "stop overlaps" : "stops overlap"} another — check the times before you set out.`
                      : stops.length > 1
                        ? "Nothing overlaps. Times and drives are estimates."
                        : "Times and drives are estimates."}
                  </p>

                  {route && (
                    <a className="btn-ghost itin-route" href={route} target="_blank" rel="noreferrer">
                      <IconPin style={{ width: 15, height: 15 }} />
                      Directions through every stop
                    </a>
                  )}
                                </>
              )}
            </div>
          </div>

          {planCount > 0 && (
            <div className="drawer-foot">
              {calendarHref && (
                <a className="btn-solid" href={calendarHref}>
                  <IconClock style={{ width: 15, height: 15 }} />
                  Add day to calendar
                </a>
              )}
              <button type="button" className="btn-ghost" onClick={onCopy}>
                <IconCopy style={{ width: 15, height: 15 }} />
                Copy
              </button>
              <button type="button" className="btn-ghost" onClick={onClear}>
                Clear
              </button>
            </div>
          )}
        </aside>
      </div>
  );
}
