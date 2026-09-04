"use client";

import type { Dispatch, RefObject } from "react";

import {
  driveMinutes,
  KIND_OPTIONS,
  resolveSort,
  SORT_LABELS,
  type SettingFilter,
  type Sort,
  type ViewAction,
  type ViewState,
} from "../../lib/filter";
import { IconX } from "./icons";

/** The bottom sheet that carries every filter on a phone. */
export function FilterSheet({
  view,
  dispatch,
  activeCount,
  resultCount,
  viewingToday,
  sheetRef,
  onClose,
  onClearAll,
}: {
  view: ViewState;
  dispatch: Dispatch<ViewAction>;
  activeCount: number;
  resultCount: number;
  viewingToday: boolean;
  sheetRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onClearAll: () => void;
}) {
  const { kind, setting, sort, maxDistance } = view;
  const resolvedSort = resolveSort(sort, viewingToday);

  return (
      <div className="scrim bottom">
        <button type="button" className="scrim-hit" onClick={onClose} aria-label="Close filters" />
        <aside className="sheet" role="dialog" aria-modal="true" aria-label="Filters" ref={sheetRef} tabIndex={-1}>
          <span className="sheet-grab" aria-hidden="true" />
          <div className="drawer-top" style={{ background: "transparent", border: 0 }}>
            <strong>Refine</strong>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close filters">
              <IconX />
            </button>
          </div>

          <div className="sheet-scroll">
            <div className="sheet-group">
              <h4>Drive time from Orchard Park</h4>
              <div className="sheet-chips">
                {[null, 5, 10, 15].map((option) => (
                  <button
                    key={String(option)}
                    type="button"
                    aria-pressed={maxDistance === option}
                    onClick={() => dispatch({ type: "maxDistance", value: option })}
                  >
                    {option === null ? `Up to 25 mi · ~${driveMinutes(25)} min` : `Up to ${option} mi · ~${driveMinutes(option)} min`}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-group">
              <h4>Activity</h4>
              <div className="sheet-chips">
                {KIND_OPTIONS.map((option) => (
                  <button key={option} type="button" aria-pressed={kind === option} onClick={() => dispatch({ type: "kind", value: option })}>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-group">
              <h4>Setting</h4>
              <div className="sheet-chips">
                {(["all", "indoor", "outdoor"] as SettingFilter[]).map((option) => (
                  <button key={option} type="button" aria-pressed={setting === option} onClick={() => dispatch({ type: "setting", value: option })}>
                    {option === "all" ? "Indoor + outdoor" : option === "indoor" ? "Indoor" : "Outdoor"}
                  </button>
                ))}
              </div>
            </div>

            <div className="sheet-group">
              <h4>Sort</h4>
              <div className="sheet-chips">
                {(["soonest", "recommended", "closest"] as Exclude<Sort, "auto">[]).map((option) => (
                  <button key={option} type="button" aria-pressed={resolvedSort === option} onClick={() => dispatch({ type: "sort", value: option })}>
                    {SORT_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="drawer-foot">
            <button type="button" className="btn-solid" onClick={onClose}>
              Show {resultCount} {resultCount === 1 ? "event" : "events"}
            </button>
            <button type="button" className="btn-ghost" onClick={onClearAll} disabled={activeCount === 0}>
              Reset
            </button>
          </div>
        </aside>
      </div>
  );
}
