import type { PaintRegion } from "@/lib/geometry/protocol";

/** AMS lite has four slots. */
export const SLOT_COUNT = 4;
export type Slot = 1 | 2 | 3 | 4;
export type Palette = [string, string, string, string];
export type Paint = Partial<Record<PaintRegion, Slot>>;

export type PaintState = {
  on: boolean;
  palette: Palette;
  slots: Paint;
};

/** Light grey, charcoal, orange, blue: readable side by side in the viewer. */
export const DEFAULT_PALETTE: Palette = ["#D9D9D9", "#3A3A3A", "#F28C28", "#2F80ED"];
export const DEFAULT_PAINT: PaintState = { on: false, palette: DEFAULT_PALETTE, slots: {} };

export const PAINT_REGIONS: Record<"bin" | "lid" | "baseplate", { region: PaintRegion; label: string }[]> = {
  bin: [
    { region: "wall-front", label: "Front wall" },
    { region: "wall-back", label: "Back wall" },
    { region: "wall-left", label: "Left wall" },
    { region: "wall-right", label: "Right wall" },
    { region: "floor", label: "Floor" },
    { region: "dividers", label: "Dividers & inserts" },
    { region: "lip", label: "Lip" },
    { region: "base", label: "Base" },
  ],
  lid: [
    { region: "lid-body", label: "Body" },
    { region: "lid-grip", label: "Grip" },
  ],
  baseplate: [
    { region: "plate-ribs", label: "Grid ribs" },
    { region: "plate-floor", label: "Floor" },
  ],
};

const ALL_REGIONS = new Set<string>(Object.values(PAINT_REGIONS).flatMap((list) => list.map((item) => item.region)));

export function slotOf(paint: Paint, region: PaintRegion | undefined): Slot {
  return (region && paint[region]) || 1;
}

export function normalHex(value: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

function isSlot(value: number): value is Slot {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** URL form: paint=1, pal=RRGGBB-RRGGBB-RRGGBB-RRGGBB, ps=region.slot,region.slot */
export function encodePaint(paint: PaintState, params: URLSearchParams) {
  if (paint.on) params.set("paint", "1");
  if (paint.palette.join() !== DEFAULT_PALETTE.join()) {
    params.set("pal", paint.palette.map((hex) => hex.slice(1)).join("-"));
  }
  const pairs = Object.entries(paint.slots)
    .filter(([, slot]) => slot && slot !== 1)
    .map(([region, slot]) => `${region}.${slot}`);
  if (pairs.length) params.set("ps", pairs.join(","));
}

export function decodePaint(params: URLSearchParams): PaintState {
  const raw = (params.get("pal") ?? "").split("-");
  const palette = DEFAULT_PALETTE.map((fallback, index) => normalHex(raw[index] ?? "") ?? fallback) as Palette;
  const slots: Paint = {};
  for (const pair of (params.get("ps") ?? "").split(",")) {
    const [region, slotRaw] = pair.split(".");
    const slot = Number(slotRaw);
    if (ALL_REGIONS.has(region) && isSlot(slot)) slots[region as PaintRegion] = slot;
  }
  // Paint view comes on by itself once any part has a colour.
  return { on: params.get("paint") === "1" || Object.keys(slots).length > 0, palette, slots };
}

export function labelOf(region: PaintRegion | undefined) {
  if (!region) return null;
  for (const list of Object.values(PAINT_REGIONS)) {
    const hit = list.find((item) => item.region === region);
    if (hit) return hit.label;
  }
  return null;
}
