"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SegmentOption<T extends string> = { value: T; label: ReactNode };

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
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
