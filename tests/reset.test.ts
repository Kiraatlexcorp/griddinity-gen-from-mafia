import { describe, expect, it } from "vitest";
import { DEFAULT_BIN, DEFAULT_LID, DEFAULT_PLATE, DEFAULT_STATE, resetTab, urlSearch, type StudioState } from "@/lib/params";

const edited: StudioState = {
  tab: "bin",
  plate: { ...DEFAULT_PLATE, magnets: !DEFAULT_PLATE.magnets },
  bin: { ...DEFAULT_BIN, gridX: DEFAULT_BIN.gridX + 2 },
  lid: { ...DEFAULT_LID, grip: "none" },
};

describe("resetTab", () => {
  it("restores only the open tab's defaults", () => {
    const bin = resetTab(edited);
    expect(bin.bin).toEqual(DEFAULT_BIN);
    expect(bin.plate).toEqual(edited.plate);
    expect(bin.lid).toEqual(edited.lid);
    expect(bin.tab).toBe("bin");
    expect(resetTab({ ...edited, tab: "baseplate" }).plate).toEqual(DEFAULT_PLATE);
    expect(resetTab({ ...edited, tab: "lid" }).lid).toEqual(DEFAULT_LID);
  });

  it("clears the URL params once everything is back at defaults", () => {
    const state = resetTab(resetTab(resetTab({ ...edited, tab: "lid" })));
    const all = ["baseplate", "bin", "lid"] as const;
    let s: StudioState = edited;
    for (const tab of all) s = resetTab({ ...s, tab });
    expect(urlSearch({ ...s, tab: "baseplate" })).toBe("");
    expect(urlSearch(DEFAULT_STATE)).toBe("");
    expect(urlSearch(edited)).not.toBe("");
    expect(state.lid).toEqual(DEFAULT_LID);
  });
});
