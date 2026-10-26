"use client";

import { useState } from "react";
import { Eye, Paintbrush } from "lucide-react";
import { SectionCard } from "@/components/studio/section-card";
import { InfoTip } from "@/components/studio/info-tip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PaintRegion } from "@/lib/geometry/protocol";
import { PAINT_REGIONS, normalHex, slotOf, type PaintState, type Slot } from "@/lib/paint";
import { cn } from "@/lib/utils";

const SLOTS: Slot[] = [1, 2, 3, 4];
const PILL =
  "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 shrink-0 rounded-full border border-black/20 dark:border-white/25", className)}
      style={{ background: color }}
    />
  );
}

/**
 * Colours card: four AMS slots on top (pick one to paint with, edit its hex),
 * then one row per part with its colour and a slot picker. Clicking a part in
 * the viewer paints it with the active slot.
 */
export function ColorsCard({
  kind,
  paint,
  active,
  present,
  printView,
  onActive,
  onChange,
  onPrintView,
}: {
  kind: "bin" | "lid" | "baseplate";
  paint: PaintState;
  active: Slot;
  /** Regions the current model has, or null when it isn't split yet. */
  present: Set<PaintRegion> | null;
  printView: boolean;
  onActive: (slot: Slot) => void;
  onChange: (next: PaintState) => void;
  onPrintView: (on: boolean) => void;
}) {
  const hex = paint.palette[active - 1];

  function setHex(value: string) {
    const clean = normalHex(value);
    if (!clean) return;
    const palette = [...paint.palette] as PaintState["palette"];
    palette[active - 1] = clean;
    onChange({ ...paint, palette });
  }

  function assign(region: PaintRegion, slot: Slot) {
    onChange({ ...paint, on: true, slots: { ...paint.slots, [region]: slot } });
  }

  const rows = PAINT_REGIONS[kind].filter((item) => !present || present.has(item.region));

  return (
    <SectionCard
      id="colors"
      title="Colors"
    >
      <div data-testid="colors-card" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={paint.on}
            onClick={() => onChange({ ...paint, on: !paint.on })}
            className={cn(
              PILL,
              paint.on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Paintbrush className="size-3.5" aria-hidden />
            Paint view
          </button>
          <button
            type="button"
            aria-pressed={printView}
            disabled={!paint.on}
            onClick={() => onPrintView(!printView)}
            className={cn(
              PILL,
              "disabled:opacity-50",
              printView ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="size-3.5" aria-hidden />
            Preview print
          </button>
          <InfoTip
            id="colors-tip"
            label="colors"
            text="Each part prints from one AMS slot (1–4). Pick a slot, then click a part in the viewer, or set it per row here. 3MF keeps the slots for Bambu Studio; STL stays one plain body. Preview print hides the grid and outlines."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1 text-xs font-medium">AMS slots</div>
          <div role="radiogroup" aria-label="Active AMS slot" className="grid grid-cols-4 gap-1">
            {SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                role="radio"
                aria-checked={active === slot}
                aria-label={`Slot ${slot}, ${paint.palette[slot - 1]}`}
                onClick={() => onActive(slot)}
                className={cn(
                  PILL,
                  "justify-center",
                  active === slot ? "border-foreground bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <Dot color={paint.palette[slot - 1]} className="size-4" />
                {slot}
              </button>
            ))}
          </div>
          <label className="flex h-7 items-center gap-2 rounded-full border border-border px-2.5 text-xs">
            <span className="text-muted-foreground">Slot {active}</span>
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

        <ul aria-label="Part colours" className="flex flex-col gap-0.5">
          {rows.map((item) => {
            const slot = slotOf(paint.slots, item.region);
            return (
              <li key={item.region} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`${item.label}: slot ${slot}. Change slot`}
                    className="grid size-6 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <Dot color={paint.palette[slot - 1]} className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {SLOTS.map((option) => (
                      <DropdownMenuItem key={option} onClick={() => assign(item.region, option)}>
                        <Dot color={paint.palette[option - 1]} />
                        Slot {option}
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{paint.palette[option - 1]}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="min-w-0 flex-1 truncate text-xs">{item.label}</span>
                <div role="radiogroup" aria-label={`${item.label} slot`} className="flex items-center gap-0.5">
                  {SLOTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={slot === option}
                      aria-label={`${item.label} slot ${option}`}
                      onClick={() => assign(item.region, option)}
                      className={cn(
                        "grid size-5 place-items-center rounded-full transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        slot === option ? "ring-2 ring-foreground ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100",
                      )}
                    >
                      <Dot color={paint.palette[option - 1]} className="size-3" />
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionCard>
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
      className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase outline-none"
    />
  );
}
