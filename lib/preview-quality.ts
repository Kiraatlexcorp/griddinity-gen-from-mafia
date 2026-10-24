import type { Quality } from "@/lib/geometry/protocol";

/** Viewer-only setting. Exports always build at "export" quality. */
export type PreviewQuality = "low" | "high";

export const PREVIEW_QUALITY_KEY = "acme-preview-quality";
export const DEFAULT_PREVIEW_QUALITY: PreviewQuality = "high";

export const PREVIEW_QUALITY_OPTIONS: { value: PreviewQuality; label: string }[] = [
  { value: "low", label: "Low poly" },
  { value: "high", label: "High quality" },
];

export function parsePreviewQuality(raw: string | null | undefined): PreviewQuality {
  return raw === "low" || raw === "high" ? raw : DEFAULT_PREVIEW_QUALITY;
}

/** Tessellation the worker builds for the viewer. High uses the export mesh. */
export function geometryQuality(quality: PreviewQuality): Quality {
  return quality === "low" ? "draft" : "export";
}
