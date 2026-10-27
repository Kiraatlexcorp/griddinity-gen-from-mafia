"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Popover } from "@base-ui/react/popover";

/**
 * Small muted info icon after a label. Hover, focus or tap shows the caption.
 * The caption also lives in a visually hidden span with `id`, so the control
 * can point aria-describedby at it while the popup is closed.
 */
export function InfoTip({ id, label, text }: { id: string; label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Sheets on phones can swallow the popover's own outside-press check,
  // so close on any pointerdown outside the icon and the popup.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);
  return (
    <>
      <span id={id} className="sr-only">
        {text}
      </span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          ref={triggerRef}
          openOnHover
          delay={120}
          closeDelay={80}
          aria-label={`About ${label}`}
          className="info-tip-trigger"
          onClick={(event) => event.stopPropagation()}
        >
          <Info aria-hidden />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side="top" align="start" sideOffset={6} className="z-[60]">
            <Popover.Popup ref={popupRef} className="info-tip-popup">{text}</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
