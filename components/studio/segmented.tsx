"use client";

import type { ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, Ban, Box, Circle, CircleDot, Crown, Feather, Frame, Ghost, Grid2x2,
  Grid3x3, Layers, LayoutGrid, Minus, Printer, Ruler, Settings2, Smile, Sparkles, Square, Weight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SegmentOption<T extends string> = { value: T; label: ReactNode };

/** Small leading icon for every plain-text option, keyed by its label. */
const ICONS: Record<string, LucideIcon> = {
  Millimetres: Ruler, "Grid units": Grid3x3, "Grid only": Square, "Pad edges": Frame,
  Plain: Square, Weighted: Weight, "42 mm": Grid2x2, "Half 21 mm": LayoutGrid,
  None: Ban, Off: Ban, On: Smile, Left: AlignLeft, Center: AlignCenter, Right: AlignRight, Full: Grid3x3,
  Corner: CircleDot, Default: Crown, Thin: Minus, Pumpkin: Circle, Halloween: Ghost,
  "Full base": Layers, Lite: Feather, Handle: Box, Hole: CircleDot,
  Mini: Printer, P1S: Printer, A1: Printer, Custom: Settings2, "Low poly": Grid2x2, "High quality": Sparkles,
};

function withIcon(label: ReactNode): ReactNode {
  if (typeof label !== "string") return label;
  const Icon = ICONS[label];
  return Icon ? <><Icon data-icon="inline-start" aria-hidden="true" className="size-3.5!" />{label}</> : label;
}

/**
 * The one segmented control: the sliding-pill look of the Baseplate / Bin / Lid
 * tabs, used for the top tabs and every single-choice group in the cards.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  ...aria
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const picked = options.find((option) => option.value === next);
        if (picked) onChange(picked.value);
      }}
    >
      <TabsList {...aria} className={cn("motion-tabs relative h-9! w-full rounded-full", className)}>
        <TabsIndicator />
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {withIcon(option.label)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
