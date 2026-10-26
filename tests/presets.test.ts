import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { buildBaseplate, buildBinSolid } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { decodeState, DEFAULT_STATE } from "@/lib/params";
import { PRESETS, presetQuery } from "@/lib/presets";
import { deletePreset, readSaved, savePreset } from "@/lib/saved-presets";
import { planBaseplate } from "@/lib/fit";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

describe("built-in presets", () => {
  it("has unique ids and both groups", () => {
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
    expect(PRESETS.filter((preset) => preset.group === "mafia").length).toBeGreaterThanOrEqual(6);
    expect(PRESETS.filter((preset) => preset.group === "classic").length).toBeGreaterThanOrEqual(6);
  });

  it.each(PRESETS.map((preset) => [preset.name, preset] as const))("%s round-trips its URL", (_, preset) => {
    expect(decodeState(presetQuery(preset))).toEqual(preset.state);
  });

  it.each(PRESETS.map((preset) => [preset.name, preset] as const))("%s builds valid geometry", (_, preset) => {
    if (preset.state.tab === "lid") {
      expect(preset.state.bin).toEqual(DEFAULT_STATE.bin);
      return;
    }
    if (preset.state.tab === "bin") {
      const solid = buildBinSolid(wasm, preset.state.bin, "preview");
      expect(solid.status()).toBe(wasm.Manifold.cube([1, 1, 1]).status());
      expect(solid.volume()).toBeGreaterThan(1000);
      expect(solid.numTri()).toBeGreaterThan(100);
      solid.delete();
    } else {
      const plan = planBaseplate(preset.state.plate);
      expect("error" in plan).toBe(false);
      if ("error" in plan) return;
      // Single-piece presets must fit one A1 bed; the puzzle preset is meant to split.
      if (preset.state.plate.connectors === "none") expect(plan.pieces).toHaveLength(1);
      else expect(plan.pieces.length).toBeGreaterThan(1);
      const parts = buildBaseplate(wasm, preset.state.plate, "preview");
      expect(parts.length).toBeGreaterThanOrEqual(plan.pieces.length);
      for (const part of parts) expect(part.indices.length).toBeGreaterThan(300);
    }
  });
});

describe("saved presets", () => {
  function memory() {
    const data = new Map<string, string>();
    return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
  }

  it("saves, replaces by name, lists newest first, and deletes", () => {
    const store = memory();
    expect(readSaved(store)).toEqual([]);
    savePreset(store, "Desk", "tab=bin&bx=1", 1);
    savePreset(store, "Garage", "tab=bin&bx=2", 2);
    const list = savePreset(store, " Desk ", "tab=bin&bx=3", 3);
    expect(list.map((item) => item.name)).toEqual(["Desk", "Garage"]);
    expect(list[0].query).toBe("tab=bin&bx=3");
    expect(deletePreset(store, "Desk").map((item) => item.name)).toEqual(["Garage"]);
    expect(savePreset(store, "   ", "x")).toHaveLength(1);
  });

  it("ignores corrupt storage", () => {
    const store = memory();
    store.setItem("acme-presets", "{not json");
    expect(readSaved(store)).toEqual([]);
  });
});
