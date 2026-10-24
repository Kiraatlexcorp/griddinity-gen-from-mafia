"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Popover } from "@base-ui/react/popover";

/**
 * Small muted info icon after a label. Hover, focus or tap shows the caption.
 * The caption also lives in a visually hidden span with `id`, so the control
 * can point aria-describedby at it while the popup is closed.
 */
export function InfoTip({ id, label, text }: { id: string; label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span id={id} className="sr-only">
        {text}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          openOnHover
          delay={120}
          closeDelay={80}
          aria-label={`About ${label}`}
          className="info-tip-trigger"
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(event) => event.stopPropagation()}
        >
          <Info aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top" align="start" sideOffset={6} className="z-50">
            <Popover.Popup className="info-tip-popup">{text}</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
