"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DEFAULT_PREVIEW_QUALITY,
  PREVIEW_QUALITY_KEY,
  PREVIEW_QUALITY_OPTIONS,
  parsePreviewQuality,
  type PreviewQuality,
} from "@/lib/preview-quality";

const listeners = new Set<() => void>();

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

export function usePreviewQuality() {
  const quality = useSyncExternalStore(
    subscribe,
    () => parsePreviewQuality(localStorage.getItem(PREVIEW_QUALITY_KEY)),
    () => DEFAULT_PREVIEW_QUALITY,
  );
  const setQuality = useCallback((next: PreviewQuality) => {
    localStorage.setItem(PREVIEW_QUALITY_KEY, next);
    for (const notify of listeners) notify();
  }, []);
  return [quality, setQuality] as const;
}

export function QualityToggle({
  value,
  onChange,
}: {
  value: PreviewQuality;
  onChange: (next: PreviewQuality) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Preview quality"
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[next.length - 1];
        if (picked) onChange(parsePreviewQuality(picked));
      }}
      className="bg-card/90 backdrop-blur"
    >
      {PREVIEW_QUALITY_OPTIONS.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="px-2.5">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
