"use client";

import { useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  Box,
  ChevronDown,
  Columns3,
  Frame,
  Grid3x3,
  Magnet,
  PanelTop,
  Printer,
  Ruler,
  Shapes,
  Sparkles,
  Square,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
          <ChevronDown data-chevron data-open={open} className="ctx-chevron" />
        </Button>
      }
    />
  );
}

/**
 * The one header every sidebar card uses: maroon tracked title on the left,
 * optional action, chevron on the right, all centred on one 28 px row.
 */
const SECTION_ICONS: Record<string, LucideIcon> = {
  presets: Sparkles,
  plate: Grid3x3,
  bed: Printer,
  frame: Frame,
  fasteners: Magnet,
  bin: Box,
  walls: Square,
  dividers: Columns3,
  features: Tag,
  lid: PanelTop,
  drawer: Ruler,
  elements: Shapes,
};

/**
 * Context-card header bar (beautifului.dev ContextCards): small primary icon,
 * 13 px medium title, optional muted tabular meta, action, chevron. The
 * hairline under it shows while the card is open.
 */
export function SectionHeader({
  id,
  title,
  open,
  meta,
  action,
}: {
  id?: string;
  title: string;
  open: boolean;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = id ? SECTION_ICONS[id] : undefined;
  return (
    <div data-slot="section-header" data-open={open} className="ctx-head flex h-10 items-center gap-2 pr-1.5 pl-3.5">
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0 text-highlight" /> : null}
      <h2 className="min-w-0 flex-1 truncate text-[13px] leading-none font-medium text-foreground">{title}</h2>
      {meta != null ? <span className="text-xs text-muted-foreground tabular-nums">{meta}</span> : null}
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
      render={<Card size="sm" className={SECTION_CARD_CLASS} />}
    >
      <SectionHeader id={id} title={title} open={open} action={action} />
      <SectionPanel>{children}</SectionPanel>
    </Collapsible>
  );
}

/**
 * Accordion body, transitions.dev P21: height + opacity + 2px blur over 250ms
 * smooth-out (Base UI drives --collapsible-panel-height and the start/end styles).
 */
export function SectionPanel({ children }: { children: ReactNode }) {
  return (
    <CollapsibleContent className="ctx-panel">
      <CardContent className="ctx-body flex flex-col gap-4 px-3.5 pt-3 pb-3.5">{children}</CardContent>
    </CollapsibleContent>
  );
}

/** Shared context-card box: surface, hairline, soft shadow, staggered fade-up. */
export const SECTION_CARD_CLASS = "ctx-card shrink-0 gap-0 py-0";
