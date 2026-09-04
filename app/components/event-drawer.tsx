"use client";

import Image from "next/image";
import type { RefObject } from "react";

import { isFree, settingLabel, type EventPick } from "../../lib/filter";
import { IconBookmark, IconExternal, IconPin, IconShare, IconTicket, IconX } from "./icons";

/** The slide-over showing one event in full. */
export function EventDrawer({
  selected,
  isSaved,
  inPlan,
  drawerRef,
  onClose,
  onToggleSave,
  onTogglePlan,
  onCopyLink,
}: {
  selected: EventPick;
  isSaved: boolean;
  inPlan: boolean;
  drawerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onToggleSave: (id: string) => void;
  onTogglePlan: (event: EventPick) => void;
  onCopyLink: (event: EventPick) => void;
}) {
  return (
      <div className="scrim">
        <button type="button" className="scrim-hit" onClick={onClose} aria-label="Close details" />
        <aside className="drawer" role="dialog" aria-modal="true" aria-label={selected.title} ref={drawerRef} tabIndex={-1}>
          <div className="drawer-top">
            <strong>{selected.day} · {selected.date}</strong>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
              <IconX />
            </button>
          </div>

          <div className="drawer-scroll">
            {selected.image && (
              <div className="drawer-hero">
                <Image src={selected.image} alt="" fill quality={70} sizes="(max-width: 760px) 100vw, 440px" />
              </div>
            )}
            <div className="drawer-body">
              <div>
                <h2>{selected.title}</h2>
                <p className="drawer-venue" style={{ marginTop: 10 }}>
                  <IconPin />
                  <span>
                    {selected.venue} · {selected.town} — {selected.distance} miles from Orchard Park
                  </span>
                </p>
              </div>

              <div className="facts">
                <div className="fact">
                  <span>When</span>
                  <b>{selected.time}</b>
                </div>
                <div className="fact">
                  <span>Cost</span>
                  <b style={isFree(selected.cost) ? { color: "var(--good)" } : undefined}>{selected.cost}</b>
                </div>
                <div className="fact">
                  <span>Setting</span>
                  <b>{settingLabel(selected.setting)}</b>
                </div>
                <div className="fact">
                  <span>Category</span>
                  <b>{selected.kind || "Community"}</b>
                </div>
              </div>

              <div className="prose">
                <h4>About this event</h4>
                <p>{selected.description}</p>
              </div>

              <div className="card-tags">
                {[...new Set(selected.tags)].map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="btn-ghost" href={selected.url} target="_blank" rel="noreferrer">
                  <IconTicket style={{ width: 15, height: 15 }} />
                  {selected.source}
                  <IconExternal style={{ width: 13, height: 13 }} />
                </a>
                <button
                  type="button"
                  className={"btn-ghost"}
                  onClick={() => onToggleSave(selected.id)}
                >
                  <IconBookmark style={{ width: 15, height: 15 }} />
                  {isSaved ? "Saved" : "Save for later"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => onCopyLink(selected)}>
                  <IconShare style={{ width: 15, height: 15 }} />
                  Copy link
                </button>
              </div>
            </div>
          </div>

          <div className="drawer-foot">
            <button type="button" className="btn-solid" onClick={() => onTogglePlan(selected)}>
              {inPlan ? "Remove from My Day" : "Add to My Day"}
            </button>
            <a className="btn-ghost" href={selected.mapUrl} target="_blank" rel="noreferrer">
              <IconPin style={{ width: 15, height: 15 }} />
              Directions
            </a>
          </div>
        </aside>
      </div>
  );
}
