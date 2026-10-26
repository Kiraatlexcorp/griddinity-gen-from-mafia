"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BAR_CLASS, HALLOWEEN_LINE } from "@/components/studio/horror-banner";
import { cn } from "@/lib/utils";
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
      className={cn(BAR_CLASS, "mx-3 mt-3 shrink-0 lg:mx-5")}
    >
      <span aria-hidden className="text-sm">🎃</span>
      <p className="min-w-0 flex-1 text-[10.5px] leading-4 font-medium text-pretty sm:text-xs sm:leading-5">
        {HALLOWEEN_LINE}
      </p>
      <button
        type="button"
        aria-label="Dismiss Halloween banner"
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
