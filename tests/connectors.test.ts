import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { meshTo3mf, boundsOf } from "@/lib/export/threemf";
import { planBaseplate } from "@/lib/fit";
import { buildBaseplate, buildClips } from "@/lib/geometry/build";
import {
  clipOutline,
  connectorSites,
  dovetailOutline,
  signedArea,
  socketOutline,
  tabOutline,
} from "@/lib/geometry/connectors";
import { loadManifold } from "@/lib/geometry/manifold";
import { DEFAULT_PLATE, type BaseplateParams } from "@/lib/params";
import {
  CLIP_THICKNESS_MM,
  CONNECTOR_CLEARANCE_MM,
  DOVETAIL_HEAD_MM,
  DOVETAIL_NECK_MM,
  PITCH_MM,
  PLATE_EDGES,
  PUZZLE_DEPTH_MM,
  SOCKET_DEPTH_MM,
} from "@/lib/spec";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

const grid3: BaseplateParams = {
  ...DEFAULT_PLATE,
  unit: "grid",
  width: 3,
  depth: 3,
  magnets: false,
  screws: false,
};

function width(outline: [number, number][]) {
  const xs = outline.map(([x]) => x);
  return Math.max(...xs) - Math.min(...xs);
}

function isManifold(positions: Float32Array, indices: Uint32Array) {
  // Every undirected edge of a closed 2-manifold is shared by exactly two triangles.
  const key = (a: number, b: number) => {
    const p = (i: number) =>
      `${positions[i * 3].toFixed(4)},${positions[i * 3 + 1].toFixed(4)},${positions[i * 3 + 2].toFixed(4)}`;
    const [x, y] = [p(a), p(b)].sort();
    return `${x}|${y}`;
  };
  const counts = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (const [a, b] of [
      [indices[t], indices[t + 1]],
      [indices[t + 1], indices[t + 2]],
      [indices[t + 2], indices[t]],
    ]) {
      const k = key(a, b);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.values()].every((count) => count === 2);
}

describe("connector parameters", () => {
  it("keeps the plate body at 42 mm per cell regardless of connectors", () => {
    for (const connectors of ["none", "clips", "puzzle"] as const) {
      for (const floor of [true, false]) {
        const params: BaseplateParams = { ...grid3, connectors, floor };
        const plan = planBaseplate(params);
        if ("error" in plan) throw new Error(plan.error);
        expect(plan.outerW).toBe(3 * PITCH_MM);
        expect(plan.outerD).toBe(3 * PITCH_MM);
      }
    }
  });

  it("makes a frame-only plate exactly one socket deep", () => {
    const plan = planBaseplate({ ...grid3, floor: false });
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.thickness).toBeCloseTo(SOCKET_DEPTH_MM, 6);
  });

  it("gives every socket 0.2 mm clearance per side over its tab", () => {
    expect(CONNECTOR_CLEARANCE_MM).toBe(0.2);
    const male = dovetailOutline("male");
    const female = dovetailOutline("female");
    expect(width(male)).toBeCloseTo(DOVETAIL_HEAD_MM, 6);
    expect(width(female)).toBeCloseTo(DOVETAIL_HEAD_MM + 2 * CONNECTOR_CLEARANCE_MM, 6);
    const maleDepth = Math.max(...male.map(([, v]) => v));
    const femaleDepth = Math.max(...female.map(([, v]) => v));
    expect(femaleDepth - maleDepth).toBeCloseTo(CONNECTOR_CLEARANCE_MM, 6);
    expect(maleDepth).toBe(PUZZLE_DEPTH_MM);
    expect(DOVETAIL_HEAD_MM).toBeGreaterThan(DOVETAIL_NECK_MM);
  });

  it("puts tabs on right and top edges, sockets on left and bottom, on inner grid lines", () => {
    const plan = planBaseplate(grid3);
    if ("error" in plan) throw new Error(plan.error);
    const sites = connectorSites(plan.pieces[0], plan, "puzzle", PLATE_EDGES);
    expect(sites).toHaveLength(8);
    for (const site of sites) {
      expect(site.gender).toBe(site.edge === "right" || site.edge === "top" ? "male" : "female");
      expect([42, 84]).toContain(site.along);
    }
    expect(connectorSites(plan.pieces[0], plan, "none", PLATE_EDGES)).toHaveLength(0);
    expect(connectorSites(plan.pieces[0], plan, "puzzle", ["right"])).toHaveLength(2);
  });

  it("adds seams between bed pieces even when no outer edge is picked", () => {
    const plan = planBaseplate({ ...grid3, width: 8, depth: 2 });
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.pieces.length).toBe(2);
    const left = connectorSites(plan.pieces[0], plan, "puzzle", []);
    const right = connectorSites(plan.pieces[1], plan, "puzzle", []);
    expect(left.every((site) => site.edge === "right" && site.seam)).toBe(true);
    expect(right.every((site) => site.edge === "left" && site.gender === "female")).toBe(true);
    expect(left.map((s) => s.along)).toEqual(right.map((s) => s.along));
  });

  it("winds every placed outline counter-clockwise", () => {
    const plan = planBaseplate(grid3);
    if ("error" in plan) throw new Error(plan.error);
    for (const site of connectorSites(plan.pieces[0], plan, "puzzle", PLATE_EDGES)) {
      expect(signedArea(tabOutline(site))).toBeGreaterThan(0);
      expect(signedArea(socketOutline(site, PUZZLE_DEPTH_MM))).toBeGreaterThan(0);
    }
    expect(signedArea(clipOutline())).toBeGreaterThan(0);
  });
});

describe("connector geometry", () => {
  it("builds a 3 by 3 frame-only puzzle plate as one manifold, 126 mm body + tabs", () => {
    const parts = buildBaseplate(wasm, { ...grid3, floor: false, connectors: "puzzle" }, "export");
    expect(parts).toHaveLength(1);
    const box = boundsOf(parts[0]);
    expect(box.minX).toBeCloseTo(0, 3);
    expect(box.minY).toBeCloseTo(0, 3);
    expect(box.maxX).toBeCloseTo(3 * PITCH_MM + PUZZLE_DEPTH_MM, 2);
    expect(box.maxY).toBeCloseTo(3 * PITCH_MM + PUZZLE_DEPTH_MM, 2);
    expect(box.maxZ - box.minZ).toBeCloseTo(SOCKET_DEPTH_MM, 3);
    expect(isManifold(parts[0].positions, parts[0].indices)).toBe(true);
    expect(meshTo3mf(parts, 256, "frame").length).toBeGreaterThan(1000);
  });

  it("opens every cell through when the floor is off", () => {
    const [part] = buildBaseplate(wasm, { ...grid3, width: 1, depth: 1, floor: false }, "preview");
    // A ray straight down the cell centre should hit no triangle.
    const cx = 21;
    const cy = 21;
    let hits = 0;
    const p = part.positions;
    const i = part.indices;
    for (let t = 0; t < i.length; t += 3) {
      const [a, b, c] = [i[t] * 3, i[t + 1] * 3, i[t + 2] * 3];
      const d = (x1: number, y1: number, x2: number, y2: number) =>
        (cx - x2) * (y1 - y2) - (x1 - x2) * (cy - y2);
      const d1 = d(p[a], p[a + 1], p[b], p[b + 1]);
      const d2 = d(p[b], p[b + 1], p[c], p[c + 1]);
      const d3 = d(p[c], p[c + 1], p[a], p[a + 1]);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) hits += 1;
    }
    expect(hits).toBe(0);
  });

  it("exports a clip set with clip pockets, both manifold", () => {
    const parts = buildBaseplate(wasm, { ...grid3, connectors: "clips" }, "preview");
    expect(parts.map((part) => part.name)).toEqual(["baseplate-1", "clips-x4"]);
    const plate = boundsOf(parts[0]);
    expect(plate.maxX - plate.minX).toBeCloseTo(126, 2);
    const clips = boundsOf(parts[1]);
    expect(clips.maxZ - clips.minZ).toBeCloseTo(CLIP_THICKNESS_MM, 3);
    for (const part of parts) expect(isManifold(part.positions, part.indices)).toBe(true);
    const clip = buildClips(wasm, 1);
    expect(clip?.status()).toBe("NoError");
    clip?.delete();
  });
});
