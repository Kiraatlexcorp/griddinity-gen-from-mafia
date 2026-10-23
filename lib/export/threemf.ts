import { strToU8, zipSync } from "fflate";
import type { MeshPart } from "@/lib/geometry/protocol";

export type ArrangedPart = {
  part: MeshPart;
  x: number;
  y: number;
  z: number;
};

/** Shelf-pack parts so a slicer opens them side by side instead of stacked. */
export function arrangeOnBed(
  parts: MeshPart[],
  bed: number,
  gap = 6,
): ArrangedPart[] {
  let cursorX = 0;
  let cursorY = 0;
  let rowDepth = 0;
  return parts.map((part) => {
    const bounds = boundsOf(part);
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxY - bounds.minY;
    if (cursorX > 0 && cursorX + width > bed + 0.1) {
      cursorY += rowDepth + gap;
      cursorX = 0;
      rowDepth = 0;
    }
    const placed = {
      part,
      x: cursorX - bounds.minX,
      y: cursorY - bounds.minY,
      z: -bounds.minZ,
    };
    cursorX += width + gap;
    rowDepth = Math.max(rowDepth, depth);
    return placed;
  });
}

export function boundsOf(part: MeshPart) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const points = part.positions;
  for (let index = 0; index < points.length; index += 3) {
    const x = points[index];
    const y = points[index + 1];
    const z = points[index + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

export function meshTo3mf(parts: MeshPart[], bed: number, title: string): Uint8Array {
  const arranged = arrangeOnBed(parts, bed);
  const objects = arranged
    .map((item, index) => objectXml(index + 1, item.part))
    .join("\n");
  const items = arranged
    .map((item, index) => {
      const transform = `1 0 0 0 1 0 0 0 1 ${fmt(item.x)} ${fmt(item.y)} ${fmt(item.z)}`;
      return `    <item objectid="${index + 1}" transform="${transform}"/>`;
    })
    .join("\n");
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">Pitch</metadata>
  <metadata name="Title">${escapeXml(title)}</metadata>
  <resources>
${objects}
  </resources>
  <build>
${items}
  </build>
</model>
`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;
  const relationships = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;
  return zipSync(
    {
      "[Content_Types].xml": strToU8(contentTypes),
      "_rels/.rels": strToU8(relationships),
      "3D/3dmodel.model": strToU8(model),
    },
    { level: 6 },
  );
}

function objectXml(id: number, part: MeshPart) {
  const vertices: string[] = [];
  const points = part.positions;
  for (let index = 0; index < points.length; index += 3) {
    vertices.push(
      `          <vertex x="${fmt(points[index])}" y="${fmt(points[index + 1])}" z="${fmt(points[index + 2])}"/>`,
    );
  }
  const triangles: string[] = [];
  for (let index = 0; index < part.indices.length; index += 3) {
    triangles.push(
      `          <triangle v1="${part.indices[index]}" v2="${part.indices[index + 1]}" v3="${part.indices[index + 2]}"/>`,
    );
  }
  return `    <object id="${id}" type="model" name="${escapeXml(part.name)}">
      <mesh>
        <vertices>
${vertices.join("\n")}
        </vertices>
        <triangles>
${triangles.join("\n")}
        </triangles>
      </mesh>
    </object>`;
}

function fmt(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
