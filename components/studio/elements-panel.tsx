"use client";

import { useState } from "react";
import {
  HEADER_BUTTON_FOCUS,
  SECTION_CARD_CLASS,
  SectionHeader,
  useSectionOpen,
} from "@/components/studio/section-card";
import { Card } from "@/components/ui/card";
import {
  Columns2,
  Plus,
  Spline,
  Trash2,
  type LucideIcon,
  Rows2,
} from "lucide-react";
import { MeasureField as Measure, SelectField } from "@/components/studio/fields";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  ELEMENT_LIMITS,
  INNER_WALLS,
  createElement,
  elementName,
  nextElementId,
  type BinElement,
  type ElementKind,
  type InnerWall,
} from "@/lib/elements";
import { formatMm } from "@/lib/params";
import { BIN_LIMITS } from "@/lib/spec";

const ICONS: Record<ElementKind, LucideIcon> = {
  wall: Columns2,
  ledge: Rows2,
  scoop: Spline,
};

const WALL_OPTIONS: { value: InnerWall; label: string }[] = INNER_WALLS.map((wall) => ({
  value: wall,
  label: wall[0].toUpperCase() + wall.slice(1) + " wall",
}));

function summary(
  element: BinElement,
  inner: { w: number; d: number },
  innerWall: number,
  scoopRadius: number,
) {
  switch (element.kind) {
    case "wall": {
      const span = element.along === "y" ? inner.w : inner.d;
      return `along ${element.along.toUpperCase()} · ${formatMm(element.position * span)} mm · ${formatMm(innerWall)} thick`;
    }
    case "ledge":
      return `${element.wall} · ${formatMm(element.height)} high · ${formatMm(element.depth)} deep`;
    case "scoop":
      return `${element.wall} · r ${formatMm(scoopRadius)} mm`;
  }
}

export function ElementsPanel({
  elements,
  inner,
  cavity,
  innerWall,
  scoop,
  onScoopChange,
  onChange,
}: {
  elements: BinElement[];
  /** Inner opening of the bin, for showing wall positions in mm. */
  inner: { w: number; d: number };
  cavity: number;
  innerWall: number;
  scoop: number;
  onScoopChange: (scoop: number) => void;
  onChange: (elements: BinElement[]) => void;
}) {
  const [open, setOpen] = useSectionOpen("elements");
  const [selected, setSelected] = useState<number | null>(null);
  const active = elements.find((element) => element.id === selected) ?? null;

  function add(kind: ElementKind) {
    const element = createElement(kind, nextElementId(elements));
    if (element.kind === "ledge") element.height = Math.max(2, Math.round(cavity * 0.6));
    onChange([...elements, element]);
    setSelected(element.id);
    setOpen(true);
  }

  function update(next: BinElement) {
    onChange(elements.map((element) => (element.id === next.id ? next : element)));
  }

  function remove(id: number) {
    onChange(elements.filter((element) => element.id !== id));
    if (selected === id) setSelected(null);
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      data-section="elements"
      render={<Card size="sm" className={SECTION_CARD_CLASS} />}
    >
      <SectionHeader
        id="elements"
        title="Elements"
        meta={elements.length}
        open={open}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="xs" className={cn("text-muted-foreground", HEADER_BUTTON_FOCUS)}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {(["wall", "ledge", "scoop"] as ElementKind[]).map((kind) => {
                const Icon = ICONS[kind];
                return (
                  <DropdownMenuItem key={kind} onClick={() => add(kind)}>
                    <Icon />
                    {kind === "wall" ? "Wall" : kind === "ledge" ? "Ledge" : "Scoop"}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <CollapsibleContent className="ctx-panel">
        <div className="ctx-body flex flex-col gap-3 px-3.5 pt-3 pb-3.5">
        {elements.length === 0 ? (
          <FieldDescription>
            No elements. Add a wall to split the bin, a ledge for a shelf, or a scoop to round
            a floor edge.
          </FieldDescription>
        ) : (
          <ul className="flex flex-col gap-1" aria-label="Bin elements">
            {elements.map((element) => {
              const Icon = ICONS[element.kind];
              const isActive = element.id === selected;
              return (
                <li key={element.id} className="flex items-center gap-1">
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={isActive}
                    className="h-auto min-w-0 flex-1 items-center justify-start gap-3 px-2.5 py-2"
                    onClick={() => setSelected(isActive ? null : element.id)}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="font-medium leading-tight">{elementName(elements, element)}</span>
                      <span className="truncate text-xs leading-tight font-normal text-muted-foreground">
                        {summary(element, inner, innerWall, scoop * cavity)}
                      </span>
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${elementName(elements, element)}`}
                    onClick={() => remove(element.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {active ? (
          <FieldGroup className="gap-4 rounded-lg border p-3">
            {active.kind === "wall" ? (
              <>
                <SelectField
                  label="Runs along"
                  value={active.along}
                  options={[
                    { value: "y", label: "Y (splits the width)" },
                    { value: "x", label: "X (splits the depth)" },
                  ]}
                  onChange={(along) => update({ ...active, along })}
                />
                <Measure
                  label="Position"
                  suffix="% OF OPENING"
                  hint={`${formatMm(active.position * (active.along === "y" ? inner.w : inner.d))} mm from the ${active.along === "y" ? "left" : "front"} inner wall.`}
                  value={Math.round(active.position * 1000) / 10}
                  min={0}
                  max={100}
                  step={0.5}
                  digits={1}
                  onChange={(value) => update({ ...active, position: value / 100 })}
                />
                <FieldDescription>
                  Thickness {formatMm(innerWall)} mm, from Inner wall under Walls.
                </FieldDescription>
                <Measure
                  label="Height"
                  suffix="MM"
                  hint="0 is full height, flush with the rim."
                  value={active.height}
                  min={0}
                  max={Math.max(1, Math.floor(cavity))}
                  step={0.5}
                  digits={1}
                  onChange={(height) => update({ ...active, height })}
                />
              </>
            ) : null}
            {active.kind === "ledge" ? (
              <>
                <SelectField
                  label="Wall"
                  value={active.wall}
                  options={WALL_OPTIONS}
                  onChange={(wall) => update({ ...active, wall })}
                />
                <Measure
                  label="Height"
                  suffix="MM"
                  hint="Top of the shelf above the floor. The underside slopes at 45° so it prints without support."
                  value={active.height}
                  min={ELEMENT_LIMITS.ledgeHeight.min}
                  max={Math.max(ELEMENT_LIMITS.ledgeHeight.min, Math.floor(cavity))}
                  step={0.5}
                  digits={1}
                  onChange={(height) => update({ ...active, height })}
                />
                <Measure
                  label="Depth"
                  suffix="MM"
                  value={active.depth}
                  min={ELEMENT_LIMITS.ledgeDepth.min}
                  max={ELEMENT_LIMITS.ledgeDepth.max}
                  step={0.5}
                  digits={1}
                  onChange={(depth) => update({ ...active, depth })}
                />
              </>
            ) : null}
            {active.kind === "scoop" ? (
              <>
                <SelectField
                  label="Wall"
                  value={active.wall}
                  options={WALL_OPTIONS}
                  onChange={(wall) => update({ ...active, wall })}
                />
                <Measure
                  label="Scoop shape"
                  suffix="× CAVITY"
                  hint={`Radius ${formatMm(scoop * cavity)} mm. Shared by every scoop; 0 turns them flat.`}
                  value={scoop}
                  min={BIN_LIMITS.scoop.min}
                  max={BIN_LIMITS.scoop.max}
                  step={BIN_LIMITS.scoop.step}
                  digits={2}
                  onChange={onScoopChange}
                />
              </>
            ) : null}
          </FieldGroup>
        ) : elements.length > 0 ? (
          <FieldDescription>Select an element to edit it.</FieldDescription>
        ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
