import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, LID_GRIPS, type StudioTab } from "@/lib/params";
import { applyPreset, designKey, presetSelection, presetsForTab } from "@/lib/presets";

const TABS: StudioTab[] = ["baseplate", "bin", "lid"];

describe("per-tab presets", () => {
  it.each(TABS)("%s tab lists only its own presets, and has some", (tab) => {
    const list = presetsForTab(tab);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const preset of list) expect(preset.state.tab).toBe(tab);
  });

  it("lid presets cover every grip", () => {
    const grips = new Set(presetsForTab("lid").map((preset) => preset.state.lid.grip));
    for (const grip of LID_GRIPS) expect(grips.has(grip)).toBe(true);
  });

  it("baseplate presets include a 6×6 A1 bed-max and magnet/plain variants", () => {
    const plates = presetsForTab("baseplate").map((preset) => preset.state.plate);
    expect(plates.some((plate) => plate.width === 6 && plate.depth === 6)).toBe(true);
    expect(plates.some((plate) => plate.magnets)).toBe(true);
    expect(plates.some((plate) => !plate.magnets && !plate.screws)).toBe(true);
  });

  it("loading a lid preset keeps the current bin size (fit) and selects it", () => {
    const current = { ...DEFAULT_STATE, tab: "lid" as const, bin: { ...DEFAULT_STATE.bin, gridX: 3, gridY: 2 } };
    const hole = presetsForTab("lid").find((preset) => preset.state.lid.grip === "hole")!;
    const next = applyPreset(current, hole);
    expect(next.bin).toEqual(current.bin);
    expect(next.lid.grip).toBe("hole");
    expect(presetSelection(next, null, [])?.picked.id).toBe(hole.id);
    expect(designKey(next)).toBe(designKey(hole.state));
  });

  it("a bin preset never matches on the lid tab", () => {
    const bin = presetsForTab("bin")[0];
    const sel = presetSelection({ ...bin.state, tab: "lid", lid: { grip: "hole" } }, null, []);
    expect(sel?.picked.id).not.toBe(bin.id);
  });
});
