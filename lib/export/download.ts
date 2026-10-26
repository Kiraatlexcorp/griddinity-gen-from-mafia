import { zipSync } from "fflate";
import type { MeshPart } from "@/lib/geometry/protocol";
import { meshTo3mf } from "@/lib/export/threemf";
import { meshToStl } from "@/lib/export/stl";
import { paintedTo3mf } from "@/lib/export/bambu3mf";
import { projectTo3mf, type ProjectSection } from "@/lib/export/project";
import type { Paint, Palette } from "@/lib/paint";

export function downloadPainted3mf(
  parts: MeshPart[],
  paint: Paint,
  palette: Palette,
  bed: number,
  filename: string,
  title: string,
) {
  const bytes = paintedTo3mf(parts, paint, palette, bed, title);
  downloadBlob(asBlob(bytes, "model/3mf"), filename.endsWith(".3mf") ? filename : `${filename}.3mf`);
}

function asBlob(bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function download3mf(parts: MeshPart[], bed: number, filename: string, title: string) {
  const bytes = meshTo3mf(parts, bed, title);
  downloadBlob(
    asBlob(bytes, "model/3mf"),
    filename.endsWith(".3mf") ? filename : `${filename}.3mf`,
  );
}

export function downloadStls(parts: MeshPart[], filename: string) {
  const stem = filename.replace(/\.stl$/i, "").replace(/\.zip$/i, "");
  if (parts.length === 1) {
    const bytes = meshToStl(parts[0]);
    downloadBlob(asBlob(bytes, "model/stl"), `${stem}.stl`);
    return;
  }
  const files: Record<string, Uint8Array> = {};
  for (const part of parts) {
    files[`${part.name}.stl`] = meshToStl(part);
  }
  const zipped = zipSync(files, { level: 6 });
  downloadBlob(asBlob(zipped, "application/zip"), `${stem}.zip`);
}

export function downloadProject3mf(
  sections: ProjectSection[],
  paint: Paint,
  palette: Palette,
  bed: number,
  filename: string,
  title: string,
) {
  const bytes = projectTo3mf(sections, paint, palette, bed, title);
  downloadBlob(asBlob(bytes, "model/3mf"), filename.endsWith(".3mf") ? filename : `${filename}.3mf`);
}

const PRESET_NAMES = ["Gridfinity Baseplate @A1", "Gridfinity Bin @A1", "Gridfinity Lid @A1"];

/** Bambu Studio "Import Configs" zip: process/<name>.json + .info, zipped in the browser. */
export async function downloadA1Presets() {
  const files: Record<string, Uint8Array> = {};
  for (const name of PRESET_NAMES) {
    for (const ext of ["json", "info"]) {
      const path = `process/${name}.${ext}`;
      const response = await fetch(`/presets/${encodeURI(path)}`);
      if (!response.ok) throw new Error(`Missing preset ${path}`);
      files[path] = new Uint8Array(await response.arrayBuffer());
    }
  }
  downloadBlob(asBlob(zipSync(files, { level: 6 }), "application/zip"), "gridfinity-a1-presets.zip");
}
