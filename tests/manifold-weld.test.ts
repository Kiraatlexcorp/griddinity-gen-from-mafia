import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { buildBin } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { decodeState } from "@/lib/params";
import { PRESETS, presetQuery } from "@/lib/presets";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

/**
 * STL has no indices, so slicers weld triangles by position. Check the mesh the
 * way a slicer sees it: weld identical float32 positions, then every directed
 * edge must have exactly one opposite partner.
 */
function weldedEdgeErrors(positions: Float32Array, indices: Uint32Array) {
  const ids = new Map<string, number>();
  const remap = new Uint32Array(positions.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const key = `${positions[3 * i]},${positions[3 * i + 1]},${positions[3 * i + 2]}`;
    if (!ids.has(key)) ids.set(key, ids.size);
    remap[i] = ids.get(key)!;
  }
  const edges = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let j = 0; j < 3; j++) {
      const key = `${remap[indices[t + j]]}>${remap[indices[t + ((j + 1) % 3)]]}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let bad = 0;
  for (const [key, count] of edges) {
    const [a, b] = key.split(">");
    if (count !== 1 || edges.get(`${b}>${a}`) !== 1) bad++;
  }
  return bad;
}

describe("exported bins survive slicer-style welding", () => {
  for (const preset of PRESETS.filter((item) => item.state.tab === "bin")) {
    it(`${preset.name} has no pinched edges`, () => {
      const bin = decodeState(presetQuery(preset)).bin;
      const [part] = buildBin(wasm, bin, "preview");
      expect(weldedEdgeErrors(part.positions, part.indices)).toBe(0);
    });
  }
});
