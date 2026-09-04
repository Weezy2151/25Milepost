"use client";

import type { Dispatch } from "react";

import {
  activeCriteria,
  driveMinutes,
  KIND_OPTIONS,
  type EventKind,
  type SettingFilter,
  type Sort,
  type ViewAction,
  type ViewState,
} from "../../lib/filter";
import { FilterMenu } from "./filter-menu";
import { IconBookmark, IconChevron, IconX } from "./icons";

/**
 * The sticky filter row, plus the chips showing what is currently applied.
 *
 * On a phone the menus collapse into a single Filters button that opens the
 * bottom sheet; the chip row stays, because it is the only thing that says
 * what is narrowing the list.
 */
export function FilterBar({
  view,
  dispatch,
  savedCount,
  resultCount,
  onOpenSheet,
  onClearAll,
}: {
  view: ViewState;
  dispatch: Dispatch<ViewAction>;
  savedCount: number;
  resultCount: number;
  onOpenSheet: () => void;
  onClearAll: () => void;
}) {
  const { kind, setting, sort, maxDistance, showSaved } = view;
  const activeFilters = activeCriteria(view);

  return (
    <>
      <div className="filterbar">
        <div className="wrap filterbar-inner">
          <button
            type="button"
            className={activeFilters.length ? "fmenu-btn on filters-mobile" : "fmenu-btn filters-mobile"}
            onClick={onOpenSheet}
          >
            Filters
            {activeFilters.length > 0 && <span className="pill-count">{activeFilters.length}</span>}
            <IconChevron />
          </button>

          <div className="filters-desktop">
          <FilterMenu
            label="Drive time"
            defaultValue="any"
            selected={maxDistance === null ? "any" : String(maxDistance)}
            options={[
              { value: "any", label: `Up to 25 mi · ~${driveMinutes(25)} min` },
              { value: "5", label: `Up to 5 mi · ~${driveMinutes(5)} min` },
              { value: "10", label: `Up to 10 mi · ~${driveMinutes(10)} min` },
              { value: "15", label: `Up to 15 mi · ~${driveMinutes(15)} min` },
            ]}
            onSelect={(value) => dispatch({ type: "maxDistance", value: value === "any" ? null : Number(value) })}
          />
          <FilterMenu
            label="Activity"
            defaultValue="All activities"
            selected={kind}
            options={KIND_OPTIONS.map((option) => ({ value: option, label: option }))}
            onSelect={(value) => dispatch({ type: "kind", value: value as EventKind })}
          />
          <FilterMenu
            label="Setting"
            defaultValue="all"
            selected={setting}
            options={[
              { value: "all", label: "Indoor + outdoor" },
              { value: "indoor", label: "Indoor" },
              { value: "outdoor", label: "Outdoor" },
            ]}
            onSelect={(value) => dispatch({ type: "setting", value: value as SettingFilter })}
          />
          </div>

          <span className="filter-spacer" />

          <button
            type="button"
            className={showSaved ? "fmenu-btn on" : "fmenu-btn"}
            aria-pressed={showSaved}
            onClick={() => dispatch({ type: "showSaved", value: !showSaved })}
          >
            <IconBookmark />
            Saved
            <b>{savedCount}</b>
          </button>
          <div className="filters-desktop">
            <FilterMenu
              label="Sort"
              align="right"
              defaultValue="recommended"
              selected={sort}
              options={[
                { value: "recommended", label: "Recommended" },
                { value: "closest", label: "Closest first" },
              ]}
              onSelect={(value) => dispatch({ type: "sort", value: value as Sort })}
            />
          </div>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="wrap">
          <div className="actives">
            <span className="actives-label">
              {resultCount} {resultCount === 1 ? "match" : "matches"}
            </span>
            {activeFilters.map((filter) => (
              <button key={filter.key} type="button" className="chip-x" onClick={() => dispatch({ type: "clear", key: filter.key })}>
                {filter.label}
                <IconX />
              </button>
            ))}
            <button type="button" className="chip-clear" onClick={onClearAll}>
              Clear all
            </button>
          </div>
        </div>
      )}
    </>
  );
}
