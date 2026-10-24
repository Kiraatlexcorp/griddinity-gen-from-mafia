import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { boundsOf } from "@/lib/export/threemf";
import { planBaseplate } from "@/lib/fit";
import { connectorSites } from "@/lib/geometry/connectors";
import { buildBaseplate, buildBinSolid, buildLid } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { DEFAULT_BIN, DEFAULT_LID, DEFAULT_PLATE, decodeState, encodeState, DEFAULT_STATE, type BinParams } from "@/lib/params";
import { HALF_PITCH_MM, cellPitch } from "@/lib/spec";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

const plain: BinParams = {
  ...DEFAULT_BIN,
  gridX: 1,
  gridY: 1,
  gridZ: 2,
  elements: [],
  label: "none",
  magnets: "none",
  screws: "none",
  lip: "none",
};

describe("half-grid", () => {
  it("uses a 21 mm pitch", () => {
    expect(HALF_PITCH_MM).toBe(21);
    expect(cellPitch(true)).toBe(21);
    expect(cellPitch(false)).toBe(42);
  });

  it("builds a 1.5 × 0.5 bin with the right footprint", () => {
    const solid = buildBinSolid(wasm, { ...plain, half: true, gridX: 1.5, gridY: 0.5 }, "preview");
    const box = solid.boundingBox();
    expect(box.max[0] - box.min[0]).toBeCloseTo(62.5, 1);
    expect(box.max[1] - box.min[1]).toBeCloseTo(20.5, 1);
    expect(solid.genus()).toBeGreaterThanOrEqual(0);
    solid.delete();
  });

  it("splits a 1×1 base into four half pads", () => {
    const full = buildBinSolid(wasm, plain, "preview");
    const half = buildBinSolid(wasm, { ...plain, half: true }, "preview");
    // Four smaller pads leave gaps between them, so less material underneath.
    expect(half.volume()).toBeLessThan(full.volume());
    // Slicing just above z=0 shows 4 separate pad islands.
    const section = half.slice(0.3);
    expect(section.toPolygons().length).toBe(4);
    expect(full.slice(0.3).toPolygons().length).toBe(1);
    full.delete();
    half.delete();
  });

  it("keeps magnets on whole cells only", () => {
    const none = buildBinSolid(wasm, { ...plain, half: true, gridX: 1.5 }, "preview");
    const mags = buildBinSolid(wasm, { ...plain, half: true, gridX: 1.5, magnets: "full" }, "preview");
    const fullNone = buildBinSolid(wasm, plain, "preview");
    const fullMags = buildBinSolid(wasm, { ...plain, magnets: "full" }, "preview");
    // 1.5 wide has one whole cell: same 4 pockets as a 1×1 bin.
    expect(none.volume() - mags.volume()).toBeCloseTo(fullNone.volume() - fullMags.volume(), 0);
    for (const s of [none, mags, fullNone, fullMags]) s.delete();
  });

  it("plans and builds a half-grid baseplate", () => {
    const params = { ...DEFAULT_PLATE, unit: "grid" as const, width: 2.5, depth: 1, half: true, magnets: false, screws: false };
    const plan = planBaseplate(params);
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.pitch).toBe(21);
    expect(plan.gridX).toBe(5);
    expect(plan.gridY).toBe(2);
    expect(plan.outerW).toBeCloseTo(105);
    const parts = buildBaseplate(wasm, params, "preview");
    const box = boundsOf(parts[0]);
    expect(box.maxX - box.minX).toBeCloseTo(105, 0);
  });

  it("puts connectors on 42 mm lines only", () => {
    const plan = planBaseplate({ ...DEFAULT_PLATE, unit: "grid", width: 8, depth: 2, bed: 100, half: true, connectors: "puzzle" });
    if ("error" in plan) throw new Error(plan.error);
    let count = 0;
    for (const piece of plan.pieces) {
      for (const site of connectorSites(piece, plan, "puzzle", [])) {
        const vertical = site.edge === "left" || site.edge === "right";
        const offset = site.along - (vertical ? piece.marginBottom : piece.marginLeft);
        expect(Math.abs(offset / 42 - Math.round(offset / 42))).toBeLessThan(1e-6);
        count += 1;
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it("builds a lid with half sockets", () => {
    const [lid] = buildLid(wasm, 1.5, 1, DEFAULT_LID, "preview", true);
    const box = boundsOf(lid);
    expect(box.maxX - box.minX).toBeCloseTo(63, 0);
    const [whole] = buildLid(wasm, 2, 1, DEFAULT_LID, "preview", false);
    const [halved] = buildLid(wasm, 2, 1, DEFAULT_LID, "preview", true);
    // Same outline, but twice the sockets per axis changes the cut volume.
    expect(halved.positions.length).not.toBe(whole.positions.length);
  });

  it("round-trips half flags and 0.5 sizes in the URL", () => {
    const state = { ...DEFAULT_STATE, bin: { ...DEFAULT_BIN, half: true, gridX: 2.5, gridY: 0.5 }, plate: { ...DEFAULT_PLATE, half: true } };
    const back = decodeState(encodeState(state));
    expect(back.bin.half).toBe(true);
    expect(back.bin.gridX).toBe(2.5);
    expect(back.bin.gridY).toBe(0.5);
    expect(back.plate.half).toBe(true);
    const whole = decodeState("bx=2.5");
    expect(whole.bin.gridX).toBe(3);
  });
});
