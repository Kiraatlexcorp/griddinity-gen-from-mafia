import { describe, expect, it } from "vitest";
import { decodeState, encodeState } from "@/lib/params";
import { designKey, PRESETS, presetQuery, presetSelection, type PickedPreset } from "@/lib/presets";

function pick(id: string): { state: ReturnType<typeof decodeState>; picked: PickedPreset } {
  const preset = PRESETS.find((item) => item.id === id)!;
  const state = decodeState(presetQuery(preset));
  return { state, picked: { source: "pack", id, name: preset.name, key: designKey(state) } };
}

describe("preset selection", () => {
  it("every pack preset is recognised after a URL round trip", () => {
    for (const preset of PRESETS) {
      const state = decodeState(presetQuery(preset));
      expect(presetSelection(state, null, [])?.picked.id).toBe(preset.id);
    }
  });

  it("names the picked preset, then marks it edited after a change", () => {
    const { state, picked } = pick("cannoli-tray");
    expect(presetSelection(state, picked, [])).toEqual({ picked, edited: false });
    const edited = { ...state, bin: { ...state.bin, gridZ: state.bin.gridZ + 1 } };
    expect(presetSelection(edited, picked, [])).toEqual({ picked, edited: true });
    // Undoing the edit clears the flag.
    expect(presetSelection(decodeState(encodeState(state)), picked, [])?.edited).toBe(false);
  });

  it("ignores the other tab and clears on a tab switch", () => {
    const { state, picked } = pick("cannoli-tray");
    const plateTweak = { ...state, plate: { ...state.plate, width: 300 } };
    expect(presetSelection(plateTweak, picked, [])?.edited).toBe(false);
    expect(presetSelection({ ...state, tab: "baseplate" }, picked, [])?.picked.id).not.toBe("cannoli-tray");
  });

  it("recognises a saved design", () => {
    const { state } = pick("cannoli-tray");
    const custom = { ...state, bin: { ...state.bin, gridX: 4 } };
    const saved = [{ name: "My tray", query: encodeState(custom) }];
    expect(presetSelection(custom, null, saved)?.picked).toMatchObject({ source: "saved", name: "My tray" });
  });
});
