"use client";

import { memo } from "react";
import Image from "next/image";

import { driveMinutes, isFree, settingLabel, type EventPick } from "../../lib/filter";
import { weatherEmoji, type DayForecast } from "../../lib/weather";
import { IconBookmark, IconCheck, IconClock, IconPin, IconPlus } from "./icons";

export const EventCard = memo(function EventCard({
  event,
  isSaved,
  inPlan,
  forecast,
  onToggleSave,
  onTogglePlan,
  onOpen,
}: {
  event: EventPick;
  isSaved: boolean;
  inPlan: boolean;
  forecast: DayForecast | null;
  onToggleSave: (id: string) => void;
  onTogglePlan: (event: EventPick) => void;
  onOpen: (event: EventPick) => void;
}) {
  const initials = event.town === "Orchard Park" ? "OP" : event.town.slice(0, 2).toUpperCase();
  // Aggregated feeds occasionally repeat a tag; de-dupe so React keys stay unique.
  const tags = [...new Set(event.tags)].slice(0, 3);

  return (
    <article className={`card accent-${event.accent}`} id={event.id}>
      <button type="button" className="card-media" onClick={() => onOpen(event)} aria-label={`Open details for ${event.title}`}>
        {event.image ? (
          <Image
            src={event.image}
            alt=""
            fill
            quality={70}
            sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 891px) calc((100vw - 72px) / 2), (max-width: 1175px) calc((100vw - 88px) / 3), 294px"
          />
        ) : (
          <span className="card-pattern">
            <em>{event.tags[0]}</em>
            <b>{initials}</b>
          </span>
        )}
        <span className="card-flags">
          <span className={event.today ? "flag today" : "flag"}>{event.day}</span>
          <span className="flag" title={event.distancePrecision === "town" ? `Approximate — measured from the centre of ${event.town}` : undefined}>
            {event.distancePrecision === "town" || event.distancePrecision === "region" ? "~" : ""}
            {event.distance} mi · ~{driveMinutes(event.distance)} min
          </span>
        </span>
      </button>

      <div className="card-body">
        <p className="card-when">
          <IconClock />
          {event.date} <span>·</span> {event.time}
        </p>
        <h3>
          <button type="button" className="card-title" onClick={() => onOpen(event)}>
            {event.title}
          </button>
        </h3>
        <p className="card-where">
          <IconPin />
          <span>
            {event.venue} · {event.town}
          </span>
        </p>
        <p className="card-desc">{event.description}</p>
        <div className="card-tags">
          {forecast && (
            <span className={forecast.rain >= 40 ? "tag weather wet" : "tag weather"} title={`${forecast.label} on the day of this event`}>
              <i aria-hidden="true">{weatherEmoji(forecast.code)}</i> {forecast.high}° · {forecast.rain}% rain
            </span>
          )}
          <span className="tag setting">{settingLabel(event.setting)}</span>
          {tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="card-foot">
        <div className="card-cost">
          <b className={isFree(event.cost) ? "free" : ""} title={event.cost}>
            {event.cost}
          </b>
          <small>via {event.source}</small>
        </div>
        <div className="card-acts">
          <button
            type="button"
            className={inPlan ? "icon-btn on" : "icon-btn"}
            onClick={() => onTogglePlan(event)}
            aria-pressed={inPlan}
            aria-label={inPlan ? `Remove ${event.title} from My Day` : `Add ${event.title} to My Day`}
            title={inPlan ? "Remove from My Day" : "Add to My Day"}
          >
            {inPlan ? <IconCheck /> : <IconPlus />}
          </button>
          <button
            type="button"
            className={isSaved ? "icon-btn on" : "icon-btn"}
            onClick={() => onToggleSave(event.id)}
            aria-pressed={isSaved}
            aria-label={isSaved ? `Remove ${event.title} from saved events` : `Save ${event.title} for later`}
            title={isSaved ? "Remove from saved" : "Save for later"}
          >
            <IconBookmark />
          </button>
          <a className="icon-btn" href={event.mapUrl} target="_blank" rel="noreferrer" aria-label={`Directions to ${event.venue}`} title={`Directions to ${event.venue}`}>
            <IconPin />
          </a>
        </div>
      </div>
    </article>
  );
});
