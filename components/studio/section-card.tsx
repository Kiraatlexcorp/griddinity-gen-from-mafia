"use client";

import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const KEY = "acme-sections";

function readSections(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Open state for one control card, remembered across visits. The server render is always open. */
export function useSectionOpen(id: string): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    subscribe,
    () => readSections()[id] ?? true,
    () => true,
  );
  useLayoutEffect(() => {
    if (!open) releasePrePaintRule(id);
  }, [id, open]);
  return [
    open,
    (next) => {
      localStorage.setItem(KEY, JSON.stringify({ ...readSections(), [id]: next }));
      for (const listener of listeners) listener();
    },
  ];
}

/**
 * Before hydration, app/layout.tsx injects CSS that hides collapsed cards.
 * Once this card renders closed itself, drop its rule so it can open again.
 */
function releasePrePaintRule(id: string) {
  const style = document.getElementById("acme-sections-pre");
  if (!style?.textContent) return;
  const rules = style.textContent.split(/(?=\[data-section=)/).filter((rule) => !rule.startsWith(`[data-section="${id}"]`));
  if (rules.length === 0) style.remove();
  else style.textContent = rules.join("");
}

/** Keyboard focus gets a ring; a tap or click does not leave one behind. */
export const HEADER_BUTTON_FOCUS =
  "focus-visible:ring-2 focus:not-focus-visible:border-transparent focus:not-focus-visible:ring-0";

export function SectionChevron({ open, label }: { open: boolean; label: string }) {
  return (
    <CollapsibleTrigger
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          className={HEADER_BUTTON_FOCUS}
          aria-label={`${open ? "Minimise" : "Expand"} ${label}`}
        >
          <ChevronDown data-chevron className={cn("transition-transform", !open && "-rotate-90")} />
        </Button>
      }
    />
  );
}

/**
 * The one header every sidebar card uses: maroon tracked title on the left,
 * optional action, chevron on the right, all centred on one 28 px row.
 */
export function SectionHeader({
  title,
  open,
  action,
}: {
  title: string;
  open: boolean;
  action?: ReactNode;
}) {
  return (
    <div data-slot="section-header" className="flex h-7 items-center gap-1 px-3">
      <h2 className="min-w-0 flex-1 truncate font-heading text-[11px] leading-none font-bold tracking-[0.18em] text-highlight uppercase">
        {title}
      </h2>
      {action}
      <SectionChevron open={open} label={title} />
    </div>
  );
}

export function SectionCard({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useSectionOpen(id);
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-section={id}
      render={<Card size="sm" className={cn(SECTION_CARD_CLASS, "motion-rise")} />}
    >
      <SectionHeader title={title} open={open} action={action} />
      <CollapsibleContent>
        <CardContent className="flex flex-col gap-4 px-3">{children}</CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Shared card box: 8 px top/bottom around the 28 px header, 12 px between header and body. */
export const SECTION_CARD_CLASS = "shrink-0 gap-3 py-2";
