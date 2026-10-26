import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { buildBinSolid, buildLidSolid } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { decodeState, DEFAULT_BIN, encodeState, DEFAULT_STATE } from "@/lib/params";
import { halloweenActive } from "@/lib/halloween";
import { presetsForTab } from "@/lib/presets";
import { BASE_PROFILE_HEIGHT_MM } from "@/lib/spec";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

const BIN = { ...DEFAULT_BIN, gridX: 2, gridY: 2, gridZ: 6, elements: [], label: "none" as const };

/** Cross-section area of a thin slice at height z. */
function sliceArea(solid: ReturnType<typeof buildBinSolid>, z: number) {
  const box = wasm.Manifold.cube([500, 500, 0.1]).translate(-250, -250, z);
  const slab = solid.intersect(box);
  const volume = slab.volume();
  slab.delete();
  box.delete();
  return volume;
}

describe("halloween shells", () => {
  it.each(["pumpkin", "halloween"] as const)("%s keeps the standard base and removes wall material", (shell) => {
    const plain = buildBinSolid(wasm, BIN, "preview");
    const styled = buildBinSolid(wasm, { ...BIN, shell, face: shell === "pumpkin" }, "preview");
    expect(styled.status()).toBe(plain.status());
    for (const z of [0.5, 2, BASE_PROFILE_HEIGHT_MM - 0.3]) {
      expect(sliceArea(styled, z)).toBeCloseTo(sliceArea(plain, z), 3);
    }
    expect(styled.volume()).toBeLessThan(plain.volume() - 10);
    plain.delete();
    styled.delete();
  });

  it("pumpkin stem lid adds a stem only with no grip", () => {
    const flat = buildLidSolid(wasm, 2, 2, { grip: "none" }, "preview");
    const stem = buildLidSolid(wasm, 2, 2, { grip: "none", stem: true }, "preview");
    expect(stem.volume()).toBeGreaterThan(flat.volume() + 100);
    flat.delete();
    stem.delete();
  });

  it("shell, face and stem round-trip the URL; plain links are unchanged", () => {
    const state = { ...DEFAULT_STATE, bin: { ...BIN, shell: "pumpkin" as const, face: true }, lid: { grip: "none" as const, stem: true } };
    expect(decodeState(encodeState(state))).toEqual(state);
    expect(encodeState(DEFAULT_STATE)).not.toContain("shell");
  });

  it("has Halloween bin and lid presets on their own tabs", () => {
    expect(presetsForTab("bin").filter((preset) => preset.group === "halloween").map((preset) => preset.id)).toEqual(
      expect.arrayContaining(["pumpkin-bin", "halloween-box"]),
    );
    expect(presetsForTab("lid").some((preset) => preset.state.lid.stem)).toBe(true);
  });

  it("banner shows through 31 Oct 2026 IST and hides after", () => {
    expect(halloweenActive(Date.parse("2026-10-31T23:59:00+05:30"))).toBe(true);
    expect(halloweenActive(Date.parse("2026-11-01T00:00:01+05:30"))).toBe(false);
  });
});
