"use client";

import { useState, useSyncExternalStore } from "react";
import { Box, Check, ChevronDown, Grid3x3, PanelTop, RotateCcw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/studio/section-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { decodeState, encodeState, type StudioState } from "@/lib/params";
import {
  designKey,
  PRESET_GROUPS,
  PRESETS,
  presetQuery,
  presetSelection,
  type PickedPreset,
} from "@/lib/presets";
import {
  deletePreset,
  readSaved,
  SAVED_KEY,
  SAVED_NAME_MAX,
  savePreset,
  type SavedPreset,
} from "@/lib/saved-presets";

/** Saving designs in the browser is built but hidden for now. Flip to bring back the save form and list. */
export const SHOW_SAVED_DESIGNS = false;

const listeners = new Set<() => void>();
const EMPTY: SavedPreset[] = [];
let cache: { raw: string | null; list: SavedPreset[] } = { raw: null, list: EMPTY };

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Same array until storage changes, as useSyncExternalStore needs. */
function snapshot() {
  const raw = localStorage.getItem(SAVED_KEY);
  if (raw !== cache.raw) cache = { raw, list: readSaved(localStorage) };
  return cache.list;
}

function notify() {
  for (const listener of listeners) listener();
}

export function PresetsCard({
  state,
  picked,
  onLoad,
  onCustom,
  onReset,
}: {
  state: StudioState;
  picked: PickedPreset | null;
  onLoad: (state: StudioState, picked: PickedPreset) => void;
  /** Keep the current values, forget the preset. */
  onCustom?: () => void;
  /** Default params for the open tab, no preset, bare URL. */
  onReset?: () => void;
}) {
  const stored = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const saved = SHOW_SAVED_DESIGNS ? stored : EMPTY;
  const [name, setName] = useState("");
  const selection = presetSelection(state, picked, saved);
  const custom = !selection || selection.edited;
  const selectedPack = selection?.picked.source === "pack" ? selection.picked.id : null;
  const selectedSaved = selection?.picked.source === "saved" ? selection.picked.id : null;
  const TriggerIcon = state.tab === "bin" ? Box : state.tab === "lid" ? PanelTop : Grid3x3;

  function load(source: PickedPreset["source"], id: string, label: string, query: string) {
    const next = decodeState(query);
    onLoad(next, { source, id, name: label, key: designKey(next) });
  }

  /** Bring the ticked preset into view once the menu has opened and laid out. */
  function scrollToPicked() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('[data-presets-menu] [aria-current="true"]')
          ?.scrollIntoView({ block: "center" });
      }),
    );
  }

  function save() {
    const trimmed = name.trim().slice(0, SAVED_NAME_MAX);
    savePreset(localStorage, name, encodeState(state));
    // The design now is that saved entry, so the trigger names it.
    onLoad(state, { source: "saved", id: trimmed, name: trimmed, key: designKey(state) });
    setName("");
    notify();
  }

  return (
    <SectionCard id="presets" title="Presets">
      <div className="flex items-center gap-1.5">
      <DropdownMenu onOpenChange={(open) => open && scrollToPicked()}>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="min-w-0 flex-1 justify-between gap-2">
              {custom ? (
                <span className="flex min-w-0 items-center gap-2">
                  <SlidersHorizontal data-icon="inline-start" />
                  <span className="truncate">Custom</span>
                  {selection ? (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      from {selection.picked.name}
                    </span>
                  ) : null}
                </span>
              ) : selection ? (
                <span className="flex min-w-0 items-center gap-2">
                  <TriggerIcon data-icon="inline-start" />
                  <span className="truncate">{selection.picked.name}</span>
                  {selection.edited ? (
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">(edited)</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">Preset pack</span>
              )}
              <ChevronDown data-icon="inline-end" />
            </Button>
          }
        />
        <DropdownMenuContent
          align="start"
          data-presets-menu=""
          className="max-h-[min(var(--available-height),32rem)] w-(--anchor-width) min-w-72 touch-pan-y overscroll-contain"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="items-start"
              aria-current={custom ? "true" : undefined}
              onClick={onCustom}
            >
              <SlidersHorizontal className="mt-0.5" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">Custom</span>
                <span className="text-xs text-muted-foreground">No preset, your own values</span>
              </span>
              {custom ? <Check aria-label="Selected" className="mt-0.5 text-highlight" /> : null}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {PRESET_GROUPS.map((group) => (
            <DropdownMenuGroup key={group.id}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {PRESETS.filter((preset) => preset.group === group.id).map((preset) => {
                const Icon = preset.state.tab === "bin" ? Box : Grid3x3;
                return (
                  <DropdownMenuItem
                    key={preset.id}
                    className="items-start"
                    aria-current={selectedPack === preset.id ? "true" : undefined}
                    onClick={() => load("pack", preset.id, preset.name, presetQuery(preset))}
                  >
                    <Icon className="mt-0.5" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{preset.name}</span>
                      <span className="text-xs text-muted-foreground">{preset.tagline}</span>
                    </span>
                    {selectedPack === preset.id ? (
                      <Check aria-label="Selected" className="mt-0.5 text-highlight" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Reset to defaults" onClick={onReset}>
              <RotateCcw />
            </Button>
          }
        />
        <TooltipContent>Reset to defaults</TooltipContent>
      </Tooltip>
      </div>

      {SHOW_SAVED_DESIGNS ? (
        <>
          <Field>
            <FieldLabel htmlFor="preset-name">Save this design</FieldLabel>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              <Input
                id="preset-name"
                value={name}
                maxLength={SAVED_NAME_MAX}
                placeholder="Name, e.g. Desk drawer"
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={!name.trim()}>
                <Save data-icon="inline-start" />
                Save
              </Button>
            </form>
            <FieldDescription>Kept in this browser. Saving an existing name replaces it.</FieldDescription>
          </Field>

          {saved.length > 0 ? (
            <ul className="flex flex-col gap-1" aria-label="Saved designs">
              {saved.map((item) => {
                const rawTab = new URLSearchParams(item.query).get("tab");
                const tab = rawTab === "bin" ? "Bin" : rawTab === "lid" ? "Lid" : "Baseplate";
                return (
                  <li key={item.name} className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto min-w-0 flex-1 justify-start py-1.5"
                      aria-current={selectedSaved === item.name ? "true" : undefined}
                      onClick={() => load("saved", item.name, item.name, item.query)}
                    >
                      {tab === "Bin" ? (
                        <Box data-icon="inline-start" />
                      ) : tab === "Lid" ? (
                        <PanelTop data-icon="inline-start" />
                      ) : (
                        <Grid3x3 data-icon="inline-start" />
                      )}
                      <span className="truncate font-medium">{item.name}</span>
                      {selectedSaved === item.name ? <Check aria-label="Selected" className="text-highlight" /> : null}
                      <span className="ml-auto text-xs text-muted-foreground">{tab}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => {
                        deletePreset(localStorage, item.name);
                        notify();
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      ) : null}
    </SectionCard>
  );
}
