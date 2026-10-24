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
    const solid = buildLidSolid(wasm, 2, 3, { grip: "none" as const }, "preview");
    const box = solid.boundingBox();
    expect(box.max[0] - box.min[0]).toBeCloseTo(2 * PITCH_MM, 1);
    expect(box.max[1] - box.min[1]).toBeCloseTo(3 * PITCH_MM, 1);
    expect(box.max[2] - box.min[2]).toBeCloseTo(lidHeight(), 1);
    expect(solid.genus()).toBeGreaterThanOrEqual(0);
    solid.delete();
  });

  it("has a plug narrower than a bin footprint at the bottom", () => {
    const solid = buildLidSolid(wasm, 2, 2, { grip: "none" as const }, "preview");
    const slice = solid.slice(0.1).bounds();
    expect(slice.max[0] - slice.min[0]).toBeLessThan(2 * PITCH_MM - 0.5);
    solid.delete();
  });

  it("grips cut clean square openings and never rise above the lid top", () => {
    const plain = buildLidSolid(wasm, 2, 2, { grip: "none" }, "preview");
    const hole = buildLidSolid(wasm, 2, 2, { grip: "hole" }, "preview");
    const handle = buildLidSolid(wasm, 2, 2, { grip: "handle" }, "preview");
    expect(hole.volume()).toBeLessThan(plain.volume());
    expect(handle.volume()).toBeLessThan(plain.volume());
    expect(handle.volume()).toBeGreaterThan(hole.volume() - 24 * 24 * 11);
    for (const solid of [hole, handle]) {
      expect(solid.boundingBox().max[2]).toBeCloseTo(plain.boundingBox().max[2], 5);
      expect(solid.genus()).toBeGreaterThan(plain.genus());
    }
    // A probe straight down through the centre: open for the hole, blocked by the bar for the handle.
    const probe = wasm.Manifold.cube([2, 2, 40]).translate(41, 41, -5);
    expect(hole.intersect(probe).volume()).toBe(0);
    expect(handle.intersect(probe).volume()).toBeGreaterThan(0);
    for (const solid of [plain, hole, handle, probe]) solid.delete();
  });

  it("maps old lnotch links to the new grip", () => {
    expect(decodeState("tab=lid&lnotch=1").lid.grip).toBe("hole");
    expect(decodeState("tab=lid&lnotch=0").lid.grip).toBe("none");
    expect(decodeState("tab=lid").lid.grip).toBe("handle");
    expect(decodeState("tab=lid&lgrip=h&lnotch=1").lid.grip).toBe("handle");
  });

  it("builds as one separate part, also via buildJob", () => {
    const parts = buildLid(wasm, 3, 1, { grip: "hole" as const }, "preview");
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe("lid-3x1");
    const viaJob = buildJob(wasm, { kind: "lid", gridX: 3, gridY: 1, params: { grip: "hole" as const } }, "preview");
    expect(viaJob.map((p) => p.name)).toEqual(["lid-3x1"]);
  });

  it("round-trips the lid tab through the URL", () => {
    const state = { ...DEFAULT_STATE, tab: "lid" as const, lid: { grip: "none" as const } };
    const back = decodeState(encodeState(state));
    expect(back.tab).toBe("lid");
    expect(back.lid.grip).toBe("none");
  });
});
