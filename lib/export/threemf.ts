import { strToU8, zipSync } from "fflate";
import type { MeshPart } from "@/lib/geometry/protocol";

export type ArrangedPart = {
  part: MeshPart;
  x: number;
  y: number;
  z: number;
  /** 0-based build plate the part landed on. */
  plate: number;
};

/** Bambu Studio lays plates out in a square-ish grid, one plate plus 20% apart. */
export function plateOrigin(plate: number, plates: number, bed: number) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(plates)));
  const stride = bed * 1.2;
  return { x: (plate % columns) * stride, y: -Math.floor(plate / columns) * stride };
}

/**
 * Shelf-pack parts onto bed-sized plates so a slicer opens them side by side
 * instead of stacked. When a plate is full the next part starts a new plate.
 */
export function arrangeOnBed(
  parts: MeshPart[],
  bed: number,
  gap = 6,
): ArrangedPart[] {
  let cursorX = 0;
  let cursorY = 0;
  let rowDepth = 0;
  let plate = 0;
  const local = parts.map((part) => {
    const bounds = boundsOf(part);
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxY - bounds.minY;
    if (cursorX > 0 && cursorX + width > bed + 0.1) {
      cursorY += rowDepth + gap;
      cursorX = 0;
      rowDepth = 0;
    }
    if (cursorY > 0 && cursorY + depth > bed + 0.1) {
      plate += 1;
      cursorX = 0;
      cursorY = 0;
      rowDepth = 0;
    }
    const placed = {
      part,
      x: cursorX - bounds.minX,
      y: cursorY - bounds.minY,
      z: -bounds.minZ,
      plate,
    };
    cursorX += width + gap;
    rowDepth = Math.max(rowDepth, depth);
    return placed;
  });
  const plates = plate + 1;
  return local.map((item) => {
    const origin = plateOrigin(item.plate, plates, bed);
    return { ...item, x: item.x + origin.x, y: item.y + origin.y };
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
  const plates = arranged.reduce((most, item) => Math.max(most, item.plate + 1), 1);
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
      ...(plates > 1 ? { "Metadata/model_settings.config": strToU8(plateSettings(arranged)) } : {}),
    },
    { level: 6 },
  );
}

/** Bambu Studio / OrcaSlicer plate assignment, one <plate> per bed. */
function plateSettings(arranged: ArrangedPart[]) {
  const plates = arranged.reduce((most, item) => Math.max(most, item.plate + 1), 1);
  const objects = arranged
    .map((item, index) => `  <object id="${index + 1}">
    <metadata key="name" value="${escapeXml(item.part.name)}"/>
  </object>`)
    .join("\n");
  const blocks = Array.from({ length: plates }, (_, plate) => {
    const instances = arranged
      .map((item, index) => (item.plate === plate ? `    <model_instance>
      <metadata key="object_id" value="${index + 1}"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>` : null))
      .filter(Boolean)
      .join("\n");
    return `  <plate>
    <metadata key="plater_id" value="${plate + 1}"/>
    <metadata key="plater_name" value="Plate ${plate + 1}"/>
${instances}
  </plate>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
${objects}
${blocks}
</config>
`;
}

export function objectXml(id: number, part: MeshPart) {
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

export function fmt(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
