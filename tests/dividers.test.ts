import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { binCavityHeight, binFootprint } from "@/lib/fit";
import { buildBinSolid, LABEL_TEXT_RAISE_MM } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { cleanLabelText, textPixels, textRects } from "@/lib/geometry/pixel-font";
import { DEFAULT_BIN, type BinParams } from "@/lib/params";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

const bin: BinParams = {
  ...DEFAULT_BIN,
  gridX: 2,
  gridY: 1,
  gridZ: 4,
  elements: [],
  label: "none",
  magnets: "none",
  screws: "none",
  lip: "none",
  wall: 1.2,
};

function measure(params: BinParams) {
  const solid = buildBinSolid(wasm, params, "preview");
  const out = { volume: solid.volume(), genus: solid.genus(), status: solid.status(), maxZ: solid.boundingBox().max[2] };
  solid.delete();
  return out;
}

const foot = binFootprint(2, 1);
const innerW = foot.width - 2.4;
const innerD = foot.depth - 2.4;
const { cavity } = binCavityHeight(4, 1.2, false);

describe("bin dividers", () => {
  it("adds one full-height wall per divider, as one valid solid", () => {
    const plain = measure(bin);
    const one = measure({ ...bin, dividersX: 1, dividerWall: 1.2 });
    expect(one.status).toBe(plain.status);
    expect(one.volume - plain.volume).toBeCloseTo(1.2 * innerD * cavity, -1);
    const grid = measure({ ...bin, dividersX: 2, dividersY: 1, dividerWall: 1.2 });
    const expected = 2 * 1.2 * innerD * cavity + 1.2 * innerW * cavity - 2 * 1.2 * 1.2 * cavity;
    expect(grid.volume - plain.volume).toBeCloseTo(expected, -1);
  });

  it("scales divider height by the percentage", () => {
    const plain = measure(bin).volume;
    const full = measure({ ...bin, dividersY: 1 }).volume - plain;
    const half = measure({ ...bin, dividersY: 1, dividerHeight: 50 }).volume - plain;
    expect(half / full).toBeGreaterThan(0.47);
    expect(half / full).toBeLessThan(0.53);
  });

  it("drops dividers that would leave openings under 8 mm", () => {
    const capped = measure({ ...bin, gridX: 1, dividersX: 11 });
    const four = measure({ ...bin, gridX: 1, dividersX: 3 });
    expect(capped.volume).toBeCloseTo(four.volume, 0);
  });
});

describe("label tab text", () => {
  it("cleans text to the font and 12 characters", () => {
    expect(cleanLabelText("m3 × 8 screws!!")).toBe("M3  8 SCREWS");
  });

  it("builds one run per horizontal stretch of pixels", () => {
    expect(textRects("I", 1)).toHaveLength(7);
    expect(textPixels(3)).toEqual({ w: 17, h: 7 });
  });

  it("raises text on the tab without changing the outside height", () => {
    const tabbed = { ...bin, gridZ: 6, label: "center" as const, lip: "default" as const };
    const plain = measure(tabbed);
    const text = measure({ ...tabbed, labelText: "ANVIL" });
    expect(text.volume).toBeGreaterThan(plain.volume + 5);
    expect(text.volume - plain.volume).toBeLessThan(40 * 12 * LABEL_TEXT_RAISE_MM);
    expect(text.maxZ).toBeCloseTo(plain.maxZ, 3);
  });

  it("skips text when there is no tab", () => {
    expect(measure({ ...bin, labelText: "ANVIL" }).volume).toBeCloseTo(measure(bin).volume, 3);
  });
});
