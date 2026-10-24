"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Segmented } from "@/components/studio/segmented";
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
    <Segmented
      aria-label="Preview quality"
      value={value}
      options={PREVIEW_QUALITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
      onChange={(next) => onChange(parsePreviewQuality(next))}
      className="w-auto bg-card/90 backdrop-blur"
    />
  );
}
