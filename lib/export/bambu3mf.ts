import { strToU8, zipSync } from "fflate";
import type { MeshPart } from "@/lib/geometry/protocol";
import { SLOT_COUNT, slotOf, type Paint, type Palette } from "@/lib/paint";
import { arrangeOnBed, escapeXml, fmt, objectXml } from "@/lib/export/threemf";

export type Group = { name: string; parts: MeshPart[] };

export function groupsOf(parts: MeshPart[]): Group[] {
  const map = new Map<string, Group>();
  for (const part of parts) {
    const key = part.group ?? part.name;
    const group = map.get(key) ?? { name: key, parts: [] };
    group.parts.push(part);
    map.set(key, group);
  }
  return [...map.values()];
}

/** One proxy mesh per group so the shelf packer sees the whole body. */
function proxyOf(group: Group): MeshPart {
  const total = group.parts.reduce((sum, part) => sum + part.positions.length, 0);
  const positions = new Float32Array(total);
  let offset = 0;
  for (const part of group.parts) {
    positions.set(part.positions, offset);
    offset += part.positions.length;
  }
  return { name: group.name, positions, indices: new Uint32Array(), placeX: 0, placeY: 0, placeZ: 0 };
}

const BAMBU_NS = "http://schemas.bambulab.com/package/2021";
const PROD_NS = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06";
const CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02";
const MATERIAL_NS = "http://schemas.microsoft.com/3dmanufacturing/material/2015/02";

/**
 * Bambu Studio project 3MF: every printed body is one object whose paint
 * regions are separate parts (volumes). model_settings.config gives each part
 * an extruder (AMS slot 1–4) and project_settings.config sets the four
 * filament colours. The mesh lives in 3D/Objects/object_1.model and the root
 * model references it through production-extension components, matching what
 * Bambu Studio itself writes.
 */
export function paintedTo3mf(
  parts: MeshPart[],
  paint: Paint,
  palette: Palette,
  bed: number,
  title: string,
): Uint8Array {
  const groups = groupsOf(parts);
  const arranged = arrangeOnBed(groups.map(proxyOf), bed);
  const plates = arranged.reduce((most, item) => Math.max(most, item.plate + 1), 1);
  return bambuPackage({
    groups,
    placed: arranged.map(({ x, y, z, plate }) => ({ x, y, z, plate })),
    plates: Array.from({ length: plates }, () => ({ name: "" })),
    paint,
    palette,
    title,
  });
}

export type PlacedGroup = { x: number; y: number; z: number; plate: number };
export type PlateInfo = { name: string; thumbnail?: Uint8Array; thumbnailSmall?: Uint8Array };

/** Writes the Bambu project package for groups already placed on plates. */
export function bambuPackage({
  groups,
  placed,
  plates: plateInfo,
  paint,
  palette,
  title,
  objectSettings: perObject = [],
}: {
  /** Per-object process overrides (e.g. wall_loops), indexed like groups. */
  objectSettings?: (Record<string, string> | undefined)[];
  groups: Group[];
  placed: PlacedGroup[];
  plates: PlateInfo[];
  paint: Paint;
  palette: Palette;
  title: string;
}): Uint8Array {
  const arranged = placed;
  const plates = plateInfo.length;
  // Resource ids are shared within a model file: basematerials takes id 1.
  let meshId = 1;
  const meshObjects: string[] = [];
  const layout = groups.map((group) => {
    const components = group.parts.map((part) => {
      meshId += 1;
      const slot = slotOf(paint, part.region);
      meshObjects.push(
        objectXml(meshId, part)
          .replace(
            `<object id="${meshId}" type="model"`,
            `<object id="${meshId}" p:UUID="${uuid(meshId, 1)}" type="model" pid="1" pindex="${slot - 1}"`,
          ),
      );
      return { id: meshId, part, slot };
    });
    return { group, components };
  });
  const assemblyBase = meshId;

  const colors = palette.map((hex) => `    <base name="Slot" displaycolor="${hex}FF"/>`).join("\n");
  const objectModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}" xmlns:BambuStudio="${BAMBU_NS}" xmlns:p="${PROD_NS}" xmlns:m="${MATERIAL_NS}" requiredextensions="p">
  <metadata name="BambuStudio:3mfVersion">1</metadata>
  <resources>
   <basematerials id="1">
${colors}
   </basematerials>
${meshObjects.join("\n")}
  </resources>
  <build/>
</model>
`;

  const assemblies = layout
    .map(({ components }, index) => {
      const id = assemblyBase + index + 1;
      const list = components
        .map(
          (component) =>
            `        <component p:path="/3D/Objects/object_1.model" objectid="${component.id}" p:UUID="${uuid(component.id, 2)}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>`,
        )
        .join("\n");
      return `    <object id="${id}" p:UUID="${uuid(id, 3)}" type="model">
      <components>
${list}
      </components>
    </object>`;
    })
    .join("\n");
  const items = arranged
    .map((item, index) => {
      const id = assemblyBase + index + 1;
      const transform = `1 0 0 0 1 0 0 0 1 ${fmt(item.x)} ${fmt(item.y)} ${fmt(item.z)}`;
      return `    <item objectid="${id}" p:UUID="${uuid(id, 4)}" transform="${transform}" printable="1"/>`;
    })
    .join("\n");
  const rootModel = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="${CORE_NS}" xmlns:BambuStudio="${BAMBU_NS}" xmlns:p="${PROD_NS}" requiredextensions="p">
  <metadata name="Application">BambuStudio-02.04.00.70</metadata>
  <metadata name="BambuStudio:3mfVersion">1</metadata>
  <metadata name="Title">${escapeXml(title)}</metadata>
  <metadata name="Designer">Gridfinity Studio</metadata>
  <resources>
${assemblies}
  </resources>
  <build p:UUID="${uuid(0, 5)}">
${items}
  </build>
</model>
`;

  const objectSettings = layout
    .map(({ group, components }, index) => {
      const id = assemblyBase + index + 1;
      const partsXml = components
        .map(
          (component) => `    <part id="${component.id}" subtype="normal_part">
      <metadata key="name" value="${escapeXml(component.part.region ?? component.part.name)}"/>
      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>
      <metadata key="extruder" value="${component.slot}"/>
    </part>`,
        )
        .join("\n");
      return `  <object id="${id}">
    <metadata key="name" value="${escapeXml(group.name)}"/>
    <metadata key="extruder" value="${components[0]?.slot ?? 1}"/>
${Object.entries(perObject[index] ?? {}).map(([k, v]) => `    <metadata key="${escapeXml(k)}" value="${escapeXml(v)}"/>\n`).join("")}${partsXml}
  </object>`;
    })
    .join("\n");
  const plateXml = Array.from({ length: plates }, (_, plate) => {
    const instances = arranged
      .map((item, index) =>
        item.plate === plate
          ? `    <model_instance>
      <metadata key="object_id" value="${assemblyBase + index + 1}"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="${index + 1}"/>
    </model_instance>`
          : null,
      )
      .filter(Boolean)
      .join("\n");
    return `  <plate>
    <metadata key="plater_id" value="${plate + 1}"/>
    <metadata key="plater_name" value="${escapeXml(plateInfo[plate].name)}"/>
    <metadata key="locked" value="false"/>${plateInfo[plate].thumbnail ? `
    <metadata key="thumbnail_file" value="Metadata/plate_${plate + 1}.png"/>` : ""}
    <metadata key="filament_map_mode" value="Auto For Flush"/>
${instances}
  </plate>`;
  }).join("\n");
  const modelSettings = `<?xml version="1.0" encoding="UTF-8"?>
<config>
${objectSettings}
${plateXml}
</config>
`;

  const n = SLOT_COUNT;
  const fill = (value: string) => Array.from({ length: n }, () => value);
  const projectSettings = {
    filament_colour: [...palette],
    filament_multi_colour: [...palette],
    default_filament_colour: fill(""),
    filament_type: fill("PLA"),
    filament_vendor: fill("Bambu Lab"),
    filament_settings_id: fill("Bambu PLA Basic @BBL A1"),
    filament_ids: fill("GFA00"),
    filament_colour_type: fill("1"),
    filament_diameter: fill("1.75"),
    filament_density: fill("1.26"),
    filament_soluble: fill("0"),
    filament_is_support: fill("0"),
    filament_map: fill("1"),
    single_extruder_multi_material: "1",
    enable_prime_tower: "1",
    // Embedded A1 0.4 / PLA / 0.20mm Standard profile so Studio opens it as an A1 project.
    printer_model: "Bambu Lab A1",
    printer_settings_id: "Bambu Lab A1 0.4 nozzle",
    printer_variant: "0.4",
    nozzle_diameter: ["0.4"],
    inherits: "0.20mm Standard @BBL A1",
    print_settings_id: "0.20mm Standard @BBL A1",
    default_print_profile: "0.20mm Standard @BBL A1",
    layer_height: "0.2",
    wall_loops: "2",
    sparse_infill_density: "15%",
    curr_bed_type: "Textured PEI Plate",
    from: "project",
    version: "02.04.00.70",
  };

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="gcode" ContentType="text/x.gcode"/>
 <Default Extension="config" ContentType="text/xml"/>
 <Default Extension="json" ContentType="application/json"/>
</Types>
`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>${plateInfo[0]?.thumbnail ? `
 <Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>
 <Relationship Target="/Metadata/plate_1_small.png" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-small"/>` : ""}
</Relationships>
`;
  const modelRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;
  const sliceInfo = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="02.04.00.70"/>
  </header>
${plateInfo.map((info, i) => `  <plate>
    <metadata key="index" value="${i + 1}"/>
    <metadata key="printer_model_id" value="N2S"/>
    <metadata key="nozzle_diameters" value="0.4"/>
  </plate>`).join("\n")}
</config>
`;
  const thumbs: Record<string, Uint8Array> = {};
  plateInfo.forEach((info, index) => {
    if (info.thumbnail) thumbs[`Metadata/plate_${index + 1}.png`] = info.thumbnail;
    if (info.thumbnailSmall) thumbs[`Metadata/plate_${index + 1}_small.png`] = info.thumbnailSmall;
  });
  const sequence = Object.fromEntries(plateInfo.map((_, index) => [`plate_${index + 1}`, { sequence: [] }]));
  return zipSync(
    {
      ...thumbs,
      "[Content_Types].xml": strToU8(contentTypes),
      "_rels/.rels": strToU8(rootRels),
      "3D/3dmodel.model": strToU8(rootModel),
      "3D/_rels/3dmodel.model.rels": strToU8(modelRels),
      "3D/Objects/object_1.model": strToU8(objectModel),
      "Metadata/model_settings.config": strToU8(modelSettings),
      "Metadata/project_settings.config": strToU8(JSON.stringify(projectSettings, null, 4)),
      "Metadata/slice_info.config": strToU8(sliceInfo),
      "Metadata/filament_sequence.json": strToU8(JSON.stringify(sequence)),
    },
    { level: 6 },
  );
}

/** Deterministic RFC-4122-shaped id; Bambu only needs these to be unique. */
function uuid(id: number, kind: number) {
  const hex = (value: number, width: number) => value.toString(16).padStart(width, "0").slice(-width);
  return `${hex(id, 8)}-${hex(kind, 4)}-4000-8000-${hex(id * 7919 + kind, 12)}`;
}
