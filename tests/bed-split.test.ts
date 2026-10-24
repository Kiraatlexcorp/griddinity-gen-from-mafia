import { beforeAll, describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import type { ManifoldToplevel } from "manifold-3d";
import { arrangeOnBed, boundsOf, meshTo3mf } from "@/lib/export/threemf";
import { planBinSplit, splitBinCells } from "@/lib/fit";
import { buildBaseplate, buildBin, buildBinSolid, buildLid } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { DEFAULT_BIN, DEFAULT_LID, DEFAULT_PLATE, type BinParams } from "@/lib/params";

const A1 = 256;
let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

const plain: BinParams = {
  ...DEFAULT_BIN,
  gridZ: 2,
  elements: [],
  label: "none",
  magnets: "none",
  screws: "none",
  lip: "none",
};

describe("bed split for the Bambu A1", () => {
  it("balances pieces on cell lines", () => {
    expect(splitBinCells(6, 42, A1)).toEqual([6]);
    expect(splitBinCells(7, 42, A1)).toEqual([4, 3]);
    expect(splitBinCells(12, 42, A1)).toEqual([6, 6]);
    expect(splitBinCells(13, 21, A1)).toEqual([7, 6]);
    expect(splitBinCells(24, 21, A1)).toEqual([12, 12]);
    expect(planBinSplit(8, 3, false, A1)).toMatchObject({ columns: [4, 4], rows: [3], pieces: 2 });
  });

  it("leaves a bin that fits in one piece", () => {
    expect(buildBin(wasm, { ...plain, gridX: 6, gridY: 6 }, "preview", A1)).toHaveLength(1);
  });

  it("cuts an 8×7 bin into 4 bed-sized pieces that keep the volume", () => {
    const params = { ...plain, gridX: 8, gridY: 7 };
    const parts = buildBin(wasm, params, "preview", A1);
    expect(parts).toHaveLength(4);
    for (const part of parts) {
      const box = boundsOf(part);
      expect(box.maxX - box.minX).toBeLessThanOrEqual(A1);
      expect(box.maxY - box.minY).toBeLessThanOrEqual(A1);
    }
    const widths = parts.map((part) => Math.round(boundsOf(part).maxX - boundsOf(part).minX));
    expect(widths).toEqual([168, 168, 168, 168]);
    const whole = buildBinSolid(wasm, params, "preview");
    const pieces = parts.map((part) => {
      const mesh = new wasm.Mesh({ numProp: 3, vertProperties: part.positions, triVerts: part.indices });
      mesh.merge();
      const solid = new wasm.Manifold(mesh);
      const volume = solid.volume();
      solid.delete();
      return volume;
    });
    expect(pieces.reduce((sum, value) => sum + value, 0)).toBeCloseTo(whole.volume(), -1);
    whole.delete();
  });

  it("splits a big lid too", () => {
    const parts = buildLid(wasm, 10, 2, DEFAULT_LID, "preview", false, A1);
    expect(parts.map((part) => Math.round(boundsOf(part).maxX - boundsOf(part).minX))).toEqual([210, 210]);
  });

  it("puts each oversize piece on its own 3MF plate", () => {
    const parts = buildBin(wasm, { ...plain, gridX: 12, gridY: 6 }, "preview", A1);
    const arranged = arrangeOnBed(parts, A1);
    expect(arranged.map((item) => item.plate)).toEqual([0, 1]);
    const files = unzipSync(meshTo3mf(parts, A1, "big bin"));
    const config = strFromU8(files["Metadata/model_settings.config"]);
    expect(config.match(/<plate>/g)).toHaveLength(2);
    expect(config).toContain('key="plater_id" value="2"');
  });

  it("splits an oversize baseplate with puzzle connectors, every piece on the bed", () => {
    const parts = buildBaseplate(
      wasm,
      { ...DEFAULT_PLATE, unit: "grid", width: 10, depth: 8, magnets: false, screws: false, connectors: "puzzle", edges: [] },
      "preview",
    );
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      const box = boundsOf(part);
      expect(box.maxX - box.minX).toBeLessThanOrEqual(A1 + 0.01);
      expect(box.maxY - box.minY).toBeLessThanOrEqual(A1 + 0.01);
    }
    const plates = new Set(arrangeOnBed(parts, A1).map((item) => item.plate));
    expect(plates.size).toBeGreaterThan(1);
  });
});
