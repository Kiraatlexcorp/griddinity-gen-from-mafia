import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { loadManifold } from "@/lib/geometry/manifold";
import { buildJob, buildLid, buildLidSolid, lidHeight } from "@/lib/geometry/build";
import { DEFAULT_STATE, decodeState, encodeState } from "@/lib/params";
import { PITCH_MM } from "@/lib/spec";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

describe("lid", () => {
  it("spans the full grid pitch and lidHeight", () => {
    const solid = buildLidSolid(wasm, 2, 3, { notch: false }, "preview");
    const box = solid.boundingBox();
    expect(box.max[0] - box.min[0]).toBeCloseTo(2 * PITCH_MM, 1);
    expect(box.max[1] - box.min[1]).toBeCloseTo(3 * PITCH_MM, 1);
    expect(box.max[2] - box.min[2]).toBeCloseTo(lidHeight(), 1);
    expect(solid.genus()).toBeGreaterThanOrEqual(0);
    solid.delete();
  });

  it("has a plug narrower than a bin footprint at the bottom", () => {
    const solid = buildLidSolid(wasm, 2, 2, { notch: false }, "preview");
    const slice = solid.slice(0.1).bounds();
    expect(slice.max[0] - slice.min[0]).toBeLessThan(2 * PITCH_MM - 0.5);
    solid.delete();
  });

  it("finger notch removes material", () => {
    const plain = buildLidSolid(wasm, 2, 2, { notch: false }, "preview");
    const notched = buildLidSolid(wasm, 2, 2, { notch: true }, "preview");
    expect(notched.volume()).toBeLessThan(plain.volume());
    plain.delete();
    notched.delete();
  });

  it("builds as one separate part, also via buildJob", () => {
    const parts = buildLid(wasm, 3, 1, { notch: true }, "preview");
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe("lid-3x1");
    const viaJob = buildJob(wasm, { kind: "lid", gridX: 3, gridY: 1, params: { notch: true } }, "preview");
    expect(viaJob.map((p) => p.name)).toEqual(["lid-3x1"]);
  });

  it("round-trips the lid tab through the URL", () => {
    const state = { ...DEFAULT_STATE, tab: "lid" as const, lid: { notch: false } };
    const back = decodeState(encodeState(state));
    expect(back.tab).toBe("lid");
    expect(back.lid.notch).toBe(false);
  });
});
