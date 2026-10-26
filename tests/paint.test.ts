import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { strFromU8, unzipSync } from "fflate";
import { loadManifold } from "@/lib/geometry/manifold";
import { PAINT_GAP_MM, buildBinSolid, buildJob } from "@/lib/geometry/build";
import type { MeshPart } from "@/lib/geometry/protocol";
import { DEFAULT_BIN, DEFAULT_STATE } from "@/lib/params";
import { paintedTo3mf } from "@/lib/export/bambu3mf";
import { DEFAULT_PALETTE, decodePaint, encodePaint } from "@/lib/paint";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

function volumeOf(part: MeshPart) {
  const p = part.positions;
  const t = part.indices;
  let sum = 0;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3;
    const b = t[i + 1] * 3;
    const c = t[i + 2] * 3;
    sum +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return sum / 6;
}

const total = (parts: MeshPart[]) => parts.reduce((sum, part) => sum + volumeOf(part), 0);
const bin2x2 = { ...DEFAULT_BIN, gridX: 2, gridY: 2, gridZ: 3 };

describe("paint split", () => {
  it("splits a bin into base, floor, four walls and lip that add back to the whole", () => {
    const whole = buildJob(wasm, { kind: "bin", params: bin2x2 }, "preview");
    const parts = buildJob(wasm, { kind: "bin", params: bin2x2, paint: true }, "preview");
    const regions = parts.map((part) => part.region);
    for (const region of ["base", "floor", "wall-front", "wall-back", "wall-left", "wall-right", "lip"]) {
      expect(regions).toContain(region);
    }
    expect(new Set(parts.map((part) => part.group)).size).toBe(1);
    expect(total(parts)).toBeCloseTo(total(whole), 0);
  });

  it("leaves the base region exactly the standard base", () => {
    const solid = buildBinSolid(wasm, bin2x2, "preview");
    const box = solid.boundingBox();
    const parts = buildJob(wasm, { kind: "bin", params: bin2x2, paint: true }, "preview");
    const base = parts.find((part) => part.region === "base")!;
    const cut = solid.translate(-box.min[0], -box.min[1], -box.min[2]).trimByPlane([0, 0, -1], -(4.75 + PAINT_GAP_MM));
    expect(volumeOf(base)).toBeCloseTo(cut.volume(), 0);
    cut.delete();
    solid.delete();
  });

  it("splits dividers, lid grip and baseplate ribs/floor", () => {
    const divided = buildJob(
      wasm,
      { kind: "bin", params: { ...bin2x2, dividersX: 1 } as typeof bin2x2, paint: true },
      "preview",
    );
    expect(divided.map((part) => part.region)).toContain("dividers");
    const lid = buildJob(wasm, { kind: "lid", gridX: 2, gridY: 2, params: { grip: "handle" }, paint: true }, "preview");
    expect(lid.map((part) => part.region).sort()).toEqual(["lid-body", "lid-grip"]);
    const plate = buildJob(wasm, { kind: "baseplate", params: { ...DEFAULT_STATE.plate, magnets: true }, paint: true }, "preview");
    expect(plate.map((part) => part.region)).toEqual(expect.arrayContaining(["plate-floor", "plate-ribs"]));
  });
});

describe("bambu 3mf", () => {
  it("writes one object with a part per region, extruder per slot and the palette", () => {
    const parts = buildJob(wasm, { kind: "bin", params: bin2x2, paint: true }, "preview");
    const paint = { "wall-front": 1, "wall-right": 2, "wall-back": 3, "wall-left": 4 } as const;
    const files = unzipSync(paintedTo3mf(parts, paint, DEFAULT_PALETTE, 256, "test"));
    const settings = strFromU8(files["Metadata/model_settings.config"]);
    expect(settings.match(/<part id=/g)).toHaveLength(parts.length);
    expect(settings).toMatch(/value="wall-left"\/>\s*<metadata key="matrix"[^>]*>\s*<metadata key="extruder" value="4"/);
    expect(settings).toMatch(/value="wall-back"\/>\s*<metadata key="matrix"[^>]*>\s*<metadata key="extruder" value="3"/);
    const project = JSON.parse(strFromU8(files["Metadata/project_settings.config"]));
    expect(project.filament_colour).toEqual(DEFAULT_PALETTE);
    const objects = strFromU8(files["3D/Objects/object_1.model"]);
    expect(objects.match(/<base name/g)).toHaveLength(4);
    expect(objects).toContain('pid="1" pindex="3"');
    const root = strFromU8(files["3D/3dmodel.model"]);
    expect(root.match(/<component /g)).toHaveLength(parts.length);
    expect(files["3D/_rels/3dmodel.model.rels"]).toBeDefined();
  });
});

// COLOR_TEST_OUT=path npx vitest run tests/paint.test.ts writes the 2x2 four-wall sample.
describe.skipIf(!process.env.COLOR_TEST_OUT)("colour test file", () => {
  it("writes a 2x2 bin with each wall on its own AMS slot", async () => {
    const { writeFileSync } = await import("node:fs");
    const parts = buildJob(wasm, { kind: "bin", params: bin2x2, paint: true }, "export");
    const bytes = paintedTo3mf(
      parts,
      { "wall-front": 1, "wall-right": 2, "wall-back": 3, "wall-left": 4 },
      ["#E53935", "#43A047", "#1E88E5", "#FDD835"],
      256,
      "Gridfinity colour test 2x2",
    );
    writeFileSync(process.env.COLOR_TEST_OUT!, bytes);
  });
});

describe("paint url", () => {
  it("round-trips palette and slot picks, and drops junk", () => {
    const params = new URLSearchParams();
    encodePaint({ on: true, palette: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00"], slots: { "wall-front": 3, lip: 2 } }, params);
    const back = decodePaint(params);
    expect(back.on).toBe(true);
    expect(back.palette).toEqual(["#FF0000", "#00FF00", "#0000FF", "#FFFF00"]);
    expect(back.slots).toEqual({ "wall-front": 3, lip: 2 });
    const junk = decodePaint(new URLSearchParams("ps=wall-front.9,nope.2&pal=zz"));
    expect(junk.slots).toEqual({});
    expect(junk.palette).toEqual(DEFAULT_PALETTE);
  });
});
