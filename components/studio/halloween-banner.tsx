"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { HALLOWEEN_DISMISS_KEY, halloweenActive } from "@/lib/halloween";

/** Seasonal strip above the preview. Hides itself after 31 Oct 2026 (IST) or once dismissed. */
export function HalloweenBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Decided after hydration: depends on the clock and this browser's storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(halloweenActive(Date.now()) && localStorage.getItem(HALLOWEEN_DISMISS_KEY) !== "1");
  }, []);
  if (!show) return null;
  return (
    <div
      role="region"
      aria-label="Halloween"
      className="flex shrink-0 items-center gap-2 border-b border-orange-500/40 bg-[linear-gradient(90deg,#0b0b0b,#2a1405_45%,#0b0b0b)] py-1.5 pr-1.5 pl-3 text-xs text-orange-100 md:rounded-t-xl"
    >
      <span aria-hidden className="text-sm">🎃</span>
      <p className="min-w-0 flex-1 truncate font-heading font-semibold tracking-tight">
        Halloween drop: pumpkin bins and a carved candy box are in Presets. Same base, spookier walls.
      </p>
      <button
        type="button"
        aria-label="Dismiss Halloween banner"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-orange-200 transition-colors hover:bg-orange-500/20 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:outline-none"
        onClick={() => {
          localStorage.setItem(HALLOWEEN_DISMISS_KEY, "1");
          setShow(false);
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
