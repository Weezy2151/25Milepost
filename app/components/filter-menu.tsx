import { useEffect, useRef, useState } from "react";

import { IconCheck, IconChevron } from "./icons";

type Option = { value: string; label: string };

export function FilterMenu({ label, options, selected, defaultValue, align = "left", onSelect }: {
  label: string;
  options: Option[];
  selected: string;
  defaultValue: string;
  align?: "left" | "right";
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = selected !== defaultValue;
  const current = options.find((option) => option.value === selected);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selected));
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    const onPointer = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, selectedIndex]);
  return <div className="fmenu" ref={ref} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={triggerRef} type="button" className={active ? "fmenu-btn on" : "fmenu-btn"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      {label}<b>{current?.label}</b><IconChevron />
    </button>
    {open && <div className={align === "right" ? "fmenu-panel right" : "fmenu-panel"} role="radiogroup" aria-label={label}>
      {options.map((option, index) => <button
        ref={(element) => { optionRefs.current[index] = element; }} key={option.value} type="button" role="radio"
        aria-checked={option.value === selected} className="fmenu-opt" tabIndex={option.value === selected ? 0 : -1}
        onKeyDown={(event) => {
          const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
          if (!delta && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + delta + options.length) % options.length;
          onSelect(options[next].value);
          optionRefs.current[next]?.focus();
        }}
        onClick={() => { onSelect(option.value); setOpen(false); queueMicrotask(() => triggerRef.current?.focus()); }}
      >{option.label}{option.value === selected && <IconCheck />}</button>)}
    </div>}
  </div>;
}
