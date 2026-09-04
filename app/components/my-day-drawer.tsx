"use client";

import type { RefObject } from "react";

import type { StoredPlanItem } from "../../lib/client-data";
import type { EventPick } from "../../lib/filter";
import { IconCopy, IconX } from "./icons";

/** The itinerary slide-over: the stops a visitor has lined up for their day. */
export function MyDayDrawer({
  planItems,
  plan,
  unavailablePlan,
  eventById,
  drawerRef,
  onClose,
  onRemove,
  onClear,
  onCopy,
}: {
  planItems: StoredPlanItem[];
  plan: EventPick[];
  unavailablePlan: StoredPlanItem[];
  eventById: Map<string, EventPick>;
  drawerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onRemove: (id: string, title: string) => void;
  onClear: () => void;
  onCopy: () => void;
}) {
  const planCount = planItems.length;

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
                    {planItems.map((item, index) => {
                      const stop = eventById.get(item.id);
                      return (
                      <div className="itin-row" key={item.id}>
                        <div className="itin-rail">
                          <span className="itin-num">{index + 1}</span>
                          <span className="itin-line" />
                        </div>
                        <div className={stop ? "itin-card" : "itin-card unavailable"}>
                          <div style={{ minWidth: 0 }}>
                            <span className="itin-time">{stop?.time ?? "Unavailable"}</span>
                            <h4>{stop?.title ?? item.title}</h4>
                            <p>
                              {stop ? `${stop.venue} · ${stop.town} — ${stop.distance} mi` : "This event is no longer in the current listings."}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => onRemove(item.id, stop?.title ?? item.title)}
                            aria-label={`Remove ${stop?.title ?? item.title} from My Day`}
                          >
                            <IconX />
                          </button>
                        </div>
                      </div>
                    );})}
                  </div>
                  <p style={{ margin: 0, color: "var(--text-3)", fontSize: 12.5 }}>
                    {plan.length === 1 && unavailablePlan.length === 0
                      ? `${plan[0].distance} miles from Orchard Park.`
                      : plan.length > 0 ? `Available stops range ${Math.min(...plan.map((stop) => stop.distance))}–${Math.max(
                          ...plan.map((stop) => stop.distance),
                        )} miles from Orchard Park.` : "Saved stops are currently unavailable."}
                  </p>
                </>
              )}
            </div>
          </div>

          {planCount > 0 && (
            <div className="drawer-foot">
              <button type="button" className="btn-solid" onClick={onCopy}>
                <IconCopy style={{ width: 15, height: 15 }} />
                Copy itinerary
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
