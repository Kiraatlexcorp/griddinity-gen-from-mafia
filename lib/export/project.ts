import type { MeshPart } from "@/lib/geometry/protocol";
import type { Paint, Palette } from "@/lib/paint";
import { boundsOf } from "@/lib/export/threemf";
import { plateOrigin } from "@/lib/export/threemf";
import { bambuPackage, groupsOf, type PlacedGroup, type PlateInfo } from "@/lib/export/bambu3mf";
import { renderThumbnail } from "@/lib/export/thumbnail";

export type ProjectSection = { name: string; parts: MeshPart[]; settings?: Record<string, string> };

/** Bed-split pieces each get a plate of their own, so the plate list can grow past 3. */
export function projectPlates(sections: ProjectSection[]) {
  return sections.flatMap((section) => {
    const groups = groupsOf(section.parts);
    return groups.map((group, index) => ({
      name: groups.length > 1 ? `${section.name} ${index + 1}/${groups.length}` : section.name,
      group,
      settings: section.settings,
    }));
  });
}

/**
 * One Bambu Studio project: baseplate, bin and lid as separate objects, each
 * centred on its own plate with a rendered plate thumbnail, sharing the four
 * AMS slots and per-region paint.
 */
export function projectTo3mf(
  sections: ProjectSection[],
  paint: Paint,
  palette: Palette,
  bed: number,
  title: string,
  thumbnails = true,
): Uint8Array {
  const plates = projectPlates(sections);
  const placed: PlacedGroup[] = plates.map(({ group }, plate) => {
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const part of group.parts) {
      const b = boundsOf(part);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      minZ = Math.min(minZ, b.minZ);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const origin = plateOrigin(plate, plates.length, bed);
    return {
      x: origin.x + bed / 2 - (minX + maxX) / 2,
      y: origin.y + bed / 2 - (minY + maxY) / 2,
      z: -minZ,
      plate,
    };
  });
  const info: PlateInfo[] = plates.map(({ name, group }) => ({
    name,
    ...(thumbnails
      ? {
          thumbnail: renderThumbnail(group.parts, paint, palette, 512),
          thumbnailSmall: renderThumbnail(group.parts, paint, palette, 128),
        }
      : {}),
  }));
  return bambuPackage({ groups: plates.map((plate) => plate.group), placed, plates: info, objectSettings: plates.map((plate) => plate.settings), paint, palette, title });
}
