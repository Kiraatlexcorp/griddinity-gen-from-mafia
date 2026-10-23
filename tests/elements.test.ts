import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import {
  createElement,
  decodeElements,
  elementName,
  encodeElements,
  nextElementId,
  type BinElement,
} from "@/lib/elements";
import { boundsOf } from "@/lib/export/threemf";
import { buildBin, buildBinSolid } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { DEFAULT_BIN, type BinParams } from "@/lib/params";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

const three: BinElement[] = [
  { id: 1, kind: "wall", along: "x", position: 0.4, height: 18 },
  { id: 2, kind: "ledge", wall: "right", height: 22.5, depth: 5 },
  { id: 3, kind: "scoop", wall: "front" },
];

describe("element params", () => {
  it("round-trips through the URL form", () => {
    expect(decodeElements(encodeElements(three))).toEqual(three);
    expect(decodeElements("")).toEqual([]);
  });

  it("clamps out-of-range values and drops junk", () => {
    const decoded = decodeElements("w-y-2-999_s-f_l-q-1-1_l-b-0-90_zz");
    expect(decoded).toEqual([
      { id: 1, kind: "wall", along: "y", position: 1, height: 84 },
      { id: 2, kind: "scoop", wall: "front" },
      { id: 3, kind: "ledge", wall: "back", height: 2, depth: 30 },
    ]);
  });

  it("still loads links that carried wall thickness and scoop radius", () => {
    expect(decodeElements("w-x-0.25-1.2-10_s-b-10")).toEqual([
      { id: 1, kind: "wall", along: "x", position: 0.25, height: 10 },
      { id: 2, kind: "scoop", wall: "back" },
    ]);
  });

  it("names elements per kind and hands out fresh ids", () => {
    const list = [...three, createElement("wall", nextElementId(three))];
    expect(list[3].id).toBe(4);
    expect(list.map((element) => elementName(list, element))).toEqual([
      "Wall 1",
      "Ledge 1",
      "Scoop 1",
      "Wall 2",
    ]);
  });
});

describe("element geometry", () => {
  const bin: BinParams = { ...DEFAULT_BIN, label: "none", elements: three };

  it("sizes walls by innerWall and scoops by the scoop fraction", () => {
    const volume = (patch: Partial<BinParams>) => {
      const solid = buildBinSolid(wasm, { ...bin, ...patch }, "preview");
      const v = solid.volume();
      solid.delete();
      return v;
    };
    const walls = [three[0]];
    expect(volume({ elements: walls, innerWall: 2 })).toBeGreaterThan(volume({ elements: walls, innerWall: 0.4 }) + 50);
    const scoops = [three[2]];
    expect(volume({ elements: scoops, scoop: 0 })).toBeCloseTo(volume({ elements: [] }), 0);
    expect(volume({ elements: scoops, scoop: 0.5 })).toBeGreaterThan(volume({ elements: scoops, scoop: 0.18 }));
  });

  it("keeps the 42 mm footprint and stays one manifold solid", () => {
    const solid = buildBinSolid(wasm, bin, "export");
    expect(solid.status()).toBe("NoError");
    expect(solid.genus()).toBeGreaterThanOrEqual(0);
    solid.delete();
    const [part] = buildBin(wasm, bin, "preview");
    const box = boundsOf(part);
    expect(box.maxX - box.minX).toBeCloseTo(125.5, 1);
    expect(box.maxY - box.minY).toBeCloseTo(83.5, 1);
  });

  it("adds volume for each wall, ledge and scoop", () => {
    const base = buildBinSolid(wasm, { ...bin, elements: [] }, "preview");
    let previous = base.volume();
    base.delete();
    for (let count = 1; count <= three.length; count += 1) {
      const solid = buildBinSolid(wasm, { ...bin, elements: three.slice(0, count) }, "preview");
      const volume = solid.volume();
      solid.delete();
      expect(volume).toBeGreaterThan(previous + 50);
      previous = volume;
    }
  });
});
