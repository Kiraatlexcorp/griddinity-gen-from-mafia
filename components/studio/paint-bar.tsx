"use client";

import { useState } from "react";
import { InfoTip } from "@/components/studio/info-tip";
import type { PaintRegion } from "@/lib/geometry/protocol";
import {
  PAINT_REGIONS,
  normalHex,
  slotOf,
  type PaintState,
  type Slot,
} from "@/lib/paint";
import { cn } from "@/lib/utils";

const SLOTS: Slot[] = [1, 2, 3, 4];

/**
 * Floating paint palette: four AMS slots with editable hex, then one pill per
 * paintable part. Pick a slot, then click a part here or in the viewer.
 */
export function PaintBar({
  kind,
  paint,
  active,
  present,
  onActive,
  onChange,
}: {
  kind: "bin" | "lid" | "baseplate";
  paint: PaintState;
  active: Slot;
  /** Regions the current model actually has. */
  present: Set<PaintRegion>;
  onActive: (slot: Slot) => void;
  onChange: (next: PaintState) => void;
}) {
  const hex = paint.palette[active - 1];

  function setHex(value: string) {
    const clean = normalHex(value);
    if (!clean) return;
    const palette = [...paint.palette] as PaintState["palette"];
    palette[active - 1] = clean;
    onChange({ ...paint, palette });
  }

  function assign(region: PaintRegion) {
    onChange({ ...paint, slots: { ...paint.slots, [region]: active } });
  }

  const regions = PAINT_REGIONS[kind].filter((item) => present.has(item.region));

  return (
    <div
      data-testid="paint-bar"
      className="pointer-events-auto flex max-w-[min(92vw,40rem)] flex-col gap-2 rounded-2xl border border-border bg-background/90 p-2 shadow-sm backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 px-1 text-xs font-medium">
          AMS slot
          <InfoTip
            id="paint-tip"
            label="paint"
            text="Pick a slot, then click a part in the viewer or below. The 3MF opens in Bambu Studio with each part on its own filament slot (1–4) in these colours. STL stays one plain body."
          />
        </span>
        <div role="radiogroup" aria-label="AMS slot" className="flex items-center gap-1">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={active === slot}
              aria-label={`Slot ${slot}, ${paint.palette[slot - 1]}`}
              onClick={() => onActive(slot)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active === slot
                  ? "border-foreground bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className="size-3.5 rounded-full border border-black/15"
                style={{ background: paint.palette[slot - 1] }}
              />
              {slot}
            </button>
          ))}
        </div>
        <label className="ml-auto flex h-7 items-center gap-1 rounded-full border border-border px-1.5 text-xs">
          <span className="sr-only">Slot {active} colour</span>
          <input
            type="color"
            value={hex.toLowerCase()}
            onChange={(event) => setHex(event.target.value)}
            className="size-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
            aria-label={`Slot ${active} colour picker`}
          />
          <HexInput key={`${active}-${hex}`} hex={hex} slot={active} onCommit={setHex} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        {regions.map((item) => {
          const slot = slotOf(paint.slots, item.region);
          return (
            <button
              key={item.region}
              type="button"
              onClick={() => assign(item.region)}
              aria-label={`Paint ${item.label} with slot ${active} (now slot ${slot})`}
              className="flex h-6 items-center gap-1 rounded-full border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full border border-black/15"
                style={{ background: paint.palette[slot - 1] }}
              />
              {item.label}
              <span className="font-mono text-[10px] opacity-70">{slot}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Remounts (via key) whenever the slot or its colour changes elsewhere. */
function HexInput({ hex, slot, onCommit }: { hex: string; slot: Slot; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(hex);
  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => (normalHex(draft) ? onCommit(draft) : setDraft(hex))}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      spellCheck={false}
      aria-label={`Slot ${slot} hex`}
      className="w-[4.5rem] bg-transparent font-mono text-xs uppercase outline-none"
    />
  );
}
