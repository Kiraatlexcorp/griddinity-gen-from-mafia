import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { strFromU8, unzipSync } from "fflate";
import { loadManifold } from "@/lib/geometry/manifold";
import { buildJob } from "@/lib/geometry/build";
import { DEFAULT_STATE } from "@/lib/params";
import { DEFAULT_PALETTE } from "@/lib/paint";
import { projectTo3mf } from "@/lib/export/project";
import { plateOrigin } from "@/lib/export/threemf";

/** Minimal XML well-formedness check: balanced tags, quoted attributes, one root. */
function wellFormed(xml: string) {
  const body = xml.replace(/^\uFEFF?<\?xml[^>]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "");
  const stack: string[] = [];
  let roots = 0;
  for (const m of body.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|<|>/g)) {
    if (!m[2]) return false;
    if (m[1]) {
      if (stack.pop() !== m[2]) return false;
    } else {
      if (stack.length === 0) roots++;
      if (!m[4]) stack.push(m[2]);
    }
  }
  return stack.length === 0 && roots === 1;
}

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

const BED = 256;

function sections(width: number, depth: number) {
  const s = DEFAULT_STATE;
  const plate = { ...s.plate, unit: "mm" as const, width, depth, pad: false };
  return [
    { name: "Baseplate", parts: buildJob(wasm, { kind: "baseplate", params: plate, paint: true }, "draft") },
    { name: "Bin", parts: buildJob(wasm, { kind: "bin", params: s.bin, bed: BED, paint: true }, "draft") },
    {
      name: "Lid",
      settings: { wall_loops: "3" },
      parts: buildJob(wasm, { kind: "lid", gridX: s.bin.gridX, gridY: s.bin.gridY, half: s.bin.half, bed: BED, params: s.lid, paint: true }, "draft"),
    },
  ];
}

function unpack(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  const text = (name: string) => strFromU8(files[name]);
  return { files, text };
}

/** World-space bounds of each build item, from the object model plus its item transform. */
function itemBounds(text: (name: string) => string) {
  const root = text("3D/3dmodel.model");
  const objects = text("3D/Objects/object_1.model");
  const meshBounds = new Map<string, number[]>();
  for (const match of objects.matchAll(/<object id="(\d+)"[\s\S]*?<\/object>/g)) {
    const xs: number[] = [], ys: number[] = [];
    for (const v of match[0].matchAll(/<vertex x="([^"]+)" y="([^"]+)"/g)) {
      xs.push(Number(v[1]));
      ys.push(Number(v[2]));
    }
    meshBounds.set(match[1], [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]);
  }
  const assemblies = new Map<string, string[]>();
  for (const match of root.matchAll(/<object id="(\d+)"[\s\S]*?<\/object>/g)) {
    assemblies.set(match[1], [...match[0].matchAll(/objectid="(\d+)"/g)].map((m) => m[1]));
  }
  return [...root.matchAll(/<item objectid="(\d+)"[^>]*transform="([^"]+)"/g)].map((item) => {
    const t = item[2].split(" ").map(Number);
    const boxes = assemblies.get(item[1])!.map((id) => meshBounds.get(id)!);
    return {
      minX: Math.min(...boxes.map((b) => b[0])) + t[9],
      maxX: Math.max(...boxes.map((b) => b[1])) + t[9],
      minY: Math.min(...boxes.map((b) => b[2])) + t[10],
      maxY: Math.max(...boxes.map((b) => b[3])) + t[10],
    };
  });
}

describe("project 3MF (baseplate + bin + lid)", () => {
  it("has 3 plates, 3 objects, valid XML, thumbnails, and every object inside its 256 mm plate", () => {
    const bytes = projectTo3mf(sections(252, 168), {}, DEFAULT_PALETTE, BED, "test");
    const { files, text } = unpack(bytes);
    for (const name of Object.keys(files).filter((n) => /\.(model|config|rels|xml)$/.test(n) && !n.endsWith("project_settings.config"))) {
      expect(wellFormed(text(name)), name).toBe(true);
    }
    expect(() => JSON.parse(text("Metadata/project_settings.config"))).not.toThrow();
    const settings = text("Metadata/model_settings.config");
    const plates = [...settings.matchAll(/<plate>[\s\S]*?<\/plate>/g)].map((m) => m[0]);
    expect(plates).toHaveLength(3);
    expect(plates.map((p) => /plater_name" value="([^"]*)"/.exec(p)![1])).toEqual(["Baseplate", "Bin", "Lid"]);
    plates.forEach((plate, index) => {
      expect(plate).toContain(`plater_id" value="${index + 1}"`);
      expect(plate.match(/<model_instance>/g)).toHaveLength(1);
      expect(plate).toContain(`thumbnail_file" value="Metadata/plate_${index + 1}.png"`);
    });
    const items = itemBounds(text);
    expect(items).toHaveLength(3);
    items.forEach((box, plate) => {
      const o = plateOrigin(plate, 3, BED);
      expect(box.minX).toBeGreaterThanOrEqual(o.x - 0.01);
      expect(box.maxX).toBeLessThanOrEqual(o.x + BED + 0.01);
      expect(box.minY).toBeGreaterThanOrEqual(o.y - 0.01);
      expect(box.maxY).toBeLessThanOrEqual(o.y + BED + 0.01);
      // Centred on its plate.
      expect((box.minX + box.maxX) / 2).toBeCloseTo(o.x + BED / 2, 1);
      expect((box.minY + box.maxY) / 2).toBeCloseTo(o.y + BED / 2, 1);
    });
    const project = JSON.parse(text("Metadata/project_settings.config"));
    expect(project.printer_model).toBe("Bambu Lab A1");
    expect(project.printer_settings_id).toBe("Bambu Lab A1 0.4 nozzle");
    expect(project.inherits).toBe("0.20mm Standard @BBL A1");
    expect(text("Metadata/slice_info.config").match(/<plate>/g)).toHaveLength(3);
    expect(settings).toContain(`wall_loops" value="3"`);
    expect(JSON.parse(text("Metadata/project_settings.config")).filament_colour).toEqual([...DEFAULT_PALETTE]);
  });

  it("writes one big and one small PNG thumbnail per plate, with real pixels", () => {
    const { files } = unpack(projectTo3mf(sections(252, 168), {}, DEFAULT_PALETTE, BED, "test"));
    const pngs = Object.keys(files).filter((n) => n.endsWith(".png")).sort();
    expect(pngs).toEqual([
      "Metadata/plate_1.png", "Metadata/plate_1_small.png",
      "Metadata/plate_2.png", "Metadata/plate_2_small.png",
      "Metadata/plate_3.png", "Metadata/plate_3_small.png",
    ]);
    for (const name of pngs) {
      const png = files[name];
      expect([...png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
      const view = new DataView(png.buffer, png.byteOffset);
      expect(view.getUint32(16)).toBe(name.includes("small") ? 128 : 512);
      expect(png.length).toBeGreaterThan(500); // not a blank image
    }
  });

  it("adds a plate per piece when the baseplate is split for the bed", () => {
    const { text } = unpack(projectTo3mf(sections(500, 380), {}, DEFAULT_PALETTE, BED, "test", false));
    const settings = text("Metadata/model_settings.config");
    const names = [...settings.matchAll(/plater_name" value="([^"]*)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(3);
    expect(names.slice(-2)).toEqual(["Bin", "Lid"]);
    expect(names[0]).toMatch(/^Baseplate 1\//);
    const items = itemBounds(text);
    expect(items).toHaveLength(names.length);
    for (const box of items) {
      expect(box.maxX - box.minX).toBeLessThanOrEqual(BED);
      expect(box.maxY - box.minY).toBeLessThanOrEqual(BED);
    }
  });
});
