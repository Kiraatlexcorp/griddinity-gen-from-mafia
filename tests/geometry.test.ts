import { beforeAll, describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import type { ManifoldToplevel } from "manifold-3d";
import { boundsOf, meshTo3mf } from "@/lib/export/threemf";
import { meshToStl, stlBounds } from "@/lib/export/stl";
import { binHeight } from "@/lib/fit";
import { buildBaseplate, buildBin, buildBinSolid } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import type { MeshPart } from "@/lib/geometry/protocol";
import { DEFAULT_BIN, type BinParams } from "@/lib/params";
import { plateThicknessMm } from "@/lib/spec";

let wasm: ManifoldToplevel;

beforeAll(async () => {
  wasm = await loadManifold();
});

function extent(part: MeshPart) {
  const box = boundsOf(part);
  return {
    ...box,
    width: box.maxX - box.minX,
    depth: box.maxY - box.minY,
    height: box.maxZ - box.minZ,
  };
}

const plainBin: BinParams = {
  ...DEFAULT_BIN,
  gridX: 1,
  gridY: 1,
  gridZ: 1,
  elements: [],
  label: "none",
  magnets: "none",
  screws: "none",
  lip: "none",
  lite: false,
};

describe("bin dimensions", () => {
  it("builds a 1 by 1 by 1 bin at 41.5 mm square and 7 mm tall", () => {
    const [part] = buildBin(wasm, plainBin, "preview");
    const box = extent(part);
    expect(box.minX).toBeCloseTo(0, 2);
    expect(box.minY).toBeCloseTo(0, 2);
    expect(box.minZ).toBeCloseTo(0, 2);
    expect(box.width).toBeCloseTo(41.5, 2);
    expect(box.depth).toBeCloseTo(41.5, 2);
    expect(box.height).toBeCloseTo(7, 2);
    expect(part.indices.length).toBeGreaterThan(30);
  });

  it("adds the 4.4 mm stacking lip on top of the height units", () => {
    const [part] = buildBin(wasm, { ...plainBin, lip: "default" }, "preview");
    expect(extent(part).height).toBeCloseTo(11.4, 2);
  });

  it("drops the lip height entirely with lip None, and keeps it for Thin", () => {
    expect(binHeight(3, "none")).toBe(21);
    expect(binHeight(3, "default")).toBeCloseTo(25.4, 6);
    expect(binHeight(3, "thin")).toBeCloseTo(25.4, 6);
    const flat = extent(buildBin(wasm, { ...plainBin, gridZ: 3, lip: "none" }, "preview")[0]);
    const thin = buildBinSolid(wasm, { ...plainBin, gridZ: 3, lip: "thin" }, "preview");
    const full = buildBinSolid(wasm, { ...plainBin, gridZ: 3, lip: "default" }, "preview");
    expect(flat.height).toBeCloseTo(21, 2);
    expect(thin.boundingBox().max[2]).toBeCloseTo(25.4, 2);
    // Thin lip has the same outside, so it uses less material.
    expect(thin.volume()).toBeLessThan(full.volume());
    thin.delete();
    full.delete();
  });

  it("puts corner holes only at the 4 outer corners", () => {
    const solid = (magnets: "none" | "corner" | "full") =>
      buildBinSolid(wasm, { ...plainBin, gridX: 2, gridY: 2, magnets }, "preview");
    const [none, corner, full] = [solid("none"), solid("corner"), solid("full")];
    const pocket = (none.volume() - corner.volume()) / 4;
    expect(pocket).toBeGreaterThan(70); // π · 3.25² · 2.4 ≈ 79.6
    expect(pocket).toBeLessThan(90);
    expect((none.volume() - full.volume()) / pocket).toBeCloseTo(16, 1);
    for (const item of [none, corner, full]) item.delete();
  });

  it("keeps the base bottom inset by the 2.95 mm profile", () => {
    const [part] = buildBin(wasm, plainBin, "export");
    let minX = Infinity;
    let maxX = -Infinity;
    const points = part.positions;
    for (let index = 0; index < points.length; index += 3) {
      if (points[index + 2] > 0.15) continue;
      minX = Math.min(minX, points[index]);
      maxX = Math.max(maxX, points[index]);
    }
    expect(minX).toBeGreaterThan(2.7);
    expect(minX).toBeLessThan(3.2);
    expect(maxX).toBeGreaterThan(41.5 - 3.2);
    expect(maxX).toBeLessThan(41.5 - 2.7);
  });

  it("builds the default 3 by 2 by 6 bin at 125.5 by 83.5 by 46.4 mm", () => {
    const [part] = buildBin(wasm, DEFAULT_BIN, "preview");
    const box = extent(part);
    expect(box.width).toBeCloseTo(125.5, 1);
    expect(box.depth).toBeCloseTo(83.5, 1);
    expect(box.height).toBeCloseTo(46.4, 1);
    const stl = stlBounds(meshToStl(part));
    expect(stl.width).toBeCloseTo(125.5, 1);
    expect(stl.height).toBeCloseTo(46.4, 1);
  });
});

describe("baseplate dimensions", () => {
  it("builds a 6 by 5 plate as one piece that fits a 256 mm bed", () => {
    const parts = buildBaseplate(
      wasm,
      {
        unit: "grid",
        width: 6,
        depth: 5,
        pad: false,
        bedPreset: "a1",
        bed: 256,
        magnets: true,
        screws: false,
        style: "plain",
      floor: true,
      connectors: "none" as const,
      edges: [],
      },
      "preview",
    );
    expect(parts).toHaveLength(1);
    const box = extent(parts[0]);
    expect(box.width).toBeCloseTo(252, 1);
    expect(box.depth).toBeCloseTo(210, 1);
    expect(box.height).toBeCloseTo(plateThicknessMm("plain", true, false), 2);
    expect(box.width).toBeLessThanOrEqual(256);
    expect(box.depth).toBeLessThanOrEqual(256);
  });

  it("exports each bed piece as its own 3MF object", () => {
    const parts = buildBaseplate(
      wasm,
      {
        unit: "mm",
        width: 300,
        depth: 84,
        pad: false,
        bedPreset: "a1",
        bed: 256,
        magnets: false,
        screws: false,
        style: "plain",
      floor: true,
      connectors: "none" as const,
      edges: [],
      },
      "preview",
    );
    expect(parts.map((part) => Math.round(extent(part).width))).toEqual([252, 42]);
    const model = strFromU8(unzipSync(meshTo3mf(parts, 256, "split"))["3D/3dmodel.model"]);
    expect(model).toContain('unit="millimeter"');
    expect(model.match(/<object /g)).toHaveLength(2);
    expect(model.match(/<item /g)).toHaveLength(2);
  });
});
