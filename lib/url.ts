/**
 * The current view, written into and read back out of the URL.
 *
 * Everything a visitor has chosen — which day, which filters, what they
 * searched for — lived only in React state, so the Share button sent people to
 * an unfiltered home page and no one could link a neighbour to "farmers
 * markets on Saturday". This is the translation both ways.
 *
 * Only what differs from the default is written, so an untouched page keeps a
 * clean URL. Reading is forgiving: anything unrecognised is ignored rather
 * than throwing, because these values arrive from whatever someone pasted into
 * the address bar.
 */

import {
  DEFAULT_VIEW,
  KIND_OPTIONS,
  MOODS,
  type EventKind,
  type SettingFilter,
  type Sort,
  type ViewState,
  type Vibe,
  WEEKEND,
} from "./filter.ts";

/** Query-string names, kept short and readable in a shared link. */
const PARAM = {
  day: "day",
  kind: "kind",
  setting: "setting",
  vibe: "vibe",
  maxDistance: "within",
  sort: "sort",
  query: "q",
  showSaved: "saved",
  freeOnly: "free",
} as const;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const SETTINGS: SettingFilter[] = ["all", "indoor", "outdoor"];
const SORTS: Sort[] = ["auto", "recommended", "closest", "soonest"];
const VIBES: Vibe[] = ["all", ...MOODS.map((mood) => mood.id)];

/** The view as query parameters, carrying only what was actually changed. */
export function viewToParams(view: ViewState): URLSearchParams {
  const params = new URLSearchParams();
  if (view.day !== null) params.set(PARAM.day, view.day);
  if (view.kind !== DEFAULT_VIEW.kind) params.set(PARAM.kind, view.kind);
  if (view.setting !== DEFAULT_VIEW.setting) params.set(PARAM.setting, view.setting);
  if (view.vibe !== DEFAULT_VIEW.vibe) params.set(PARAM.vibe, view.vibe);
  if (view.maxDistance !== null) params.set(PARAM.maxDistance, String(view.maxDistance));
  if (view.sort !== DEFAULT_VIEW.sort) params.set(PARAM.sort, view.sort);
  const query = view.query.trim();
  if (query) params.set(PARAM.query, query);
  if (view.showSaved) params.set(PARAM.showSaved, "1");
  if (view.freeOnly) params.set(PARAM.freeOnly, "1");
  return params;
}

/**
 * Rebuild a view from query parameters, falling back to the default for
 * anything missing or unrecognised.
 */
export function viewFromParams(params: URLSearchParams): ViewState {
  const view: ViewState = { ...DEFAULT_VIEW };

  const day = params.get(PARAM.day);
  if (day && (DATE_KEY.test(day) || day === WEEKEND)) view.day = day;

  const kind = params.get(PARAM.kind);
  if (kind && (KIND_OPTIONS as string[]).includes(kind)) view.kind = kind as EventKind;

  const setting = params.get(PARAM.setting);
  if (setting && (SETTINGS as string[]).includes(setting)) view.setting = setting as SettingFilter;

  const vibe = params.get(PARAM.vibe);
  if (vibe && (VIBES as string[]).includes(vibe)) view.vibe = vibe as Vibe;

  const within = params.get(PARAM.maxDistance);
  if (within !== null) {
    const miles = Number(within);
    // A distance has to be a real number of miles inside the app's radius.
    if (Number.isFinite(miles) && miles > 0 && miles <= 100) view.maxDistance = Math.round(miles);
  }

  const sort = params.get(PARAM.sort);
  if (sort && (SORTS as string[]).includes(sort)) view.sort = sort as Sort;

  const query = params.get(PARAM.query);
  if (query) view.query = query.slice(0, 120);

  if (params.get(PARAM.showSaved) === "1") view.showSaved = true;
  if (params.get(PARAM.freeOnly) === "1") view.freeOnly = true;

  return view;
}

/** The path-and-query a view should be showing, for history.replaceState. */
export function viewToUrl(view: ViewState, pathname: string, hash = ""): string {
  const params = viewToParams(view).toString();
  return `${pathname}${params ? `?${params}` : ""}${hash}`;
}

/**
 * Which overlay the URL fragment is asking for.
 *
 * Overlays live in the fragment so that closing one is a history step back —
 * on a phone, tapping Back with a drawer open should close the drawer, not
 * leave the site.
 */
export type Overlay = { kind: "event"; id: string } | { kind: "my-day" } | { kind: "filters" } | null;

const EVENT_HASH = "#event-";

export function overlayFromHash(hash: string): Overlay {
  if (hash === "#my-day") return { kind: "my-day" };
  if (hash === "#filters") return { kind: "filters" };
  if (hash.startsWith(EVENT_HASH)) {
    const id = decodeURIComponent(hash.slice(EVENT_HASH.length));
    return id ? { kind: "event", id } : null;
  }
  return null;
}

export function overlayToHash(overlay: Overlay): string {
  if (overlay === null) return "";
  if (overlay.kind === "my-day") return "#my-day";
  if (overlay.kind === "filters") return "#filters";
  return `${EVENT_HASH}${encodeURIComponent(overlay.id)}`;
}
