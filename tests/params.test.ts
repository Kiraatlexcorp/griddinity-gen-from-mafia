import { describe, expect, it } from "vitest";
import { decodeState, encodeState, type StudioState } from "@/lib/params";

describe("shareable URLs", () => {
  it("round-trips plate and bin parameters", () => {
    const state: StudioState = {
      tab: "bin",
      plate: {
        unit: "mm",
        width: 500,
        depth: 380,
        pad: true,
        bedPreset: "mini",
        bed: 180,
        magnets: false,
        screws: true,
        style: "weighted",
        floor: true,
        connectors: "puzzle" as const,
        edges: ["right" as const, "top" as const],
      },
      bin: {
        gridX: 3,
        gridY: 2,
        gridZ: 6,
        elements: [
          { id: 1, kind: "wall", along: "y", position: 0.5, height: 0 },
          { id: 2, kind: "ledge", wall: "back", height: 20, depth: 6 },
          { id: 3, kind: "scoop", wall: "left" },
        ],
        label: "left",
        magnets: "corner" as const,
        screws: "full" as const,
        lip: "thin" as const,
        lite: true,
        wall: 1.6,
        innerWall: 0.6,
        scoop: 0.35,
        dividersX: 2,
        dividersY: 1,
        dividerWall: 1.4,
        dividerHeight: 65,
        labelText: "M3 SCREWS",
      },
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded).toEqual(state);
  });

  it("falls back to printable defaults for an empty query", () => {
    const decoded = decodeState("");
    expect(decoded.tab).toBe("baseplate");
    expect(decoded.plate.bed).toBe(256);
    expect(decoded.plate.width).toBe(252);
    expect(decoded.bin).toMatchObject({ gridX: 3, gridY: 2, gridZ: 6, wall: 1.2, lip: "default" });
  });

  it("converts legacy divider and scoop keys into elements", () => {
    const decoded = decodeState("tab=bin&dx=2&dy=1&scoop=0&wall=1.6");
    expect(decoded.bin.elements).toEqual([
      { id: 1, kind: "wall", along: "y", position: 1 / 3, height: 0 },
      { id: 2, kind: "wall", along: "y", position: 2 / 3, height: 0 },
      { id: 3, kind: "wall", along: "x", position: 0.5, height: 0 },
    ]);
    // The old single wall setting also sized the dividers.
    expect(decoded.bin.innerWall).toBe(1.6);
  });

  it("defaults the floor on and connectors off for old plate links", () => {
    const decoded = decodeState("tab=baseplate&w=252&d=168");
    expect(decoded.plate.floor).toBe(true);
    expect(decoded.plate.connectors).toBe("none");
    expect(decoded.plate.edges).toEqual(["left", "right", "bottom", "top"]);
  });

  it("clamps and snaps bin options to their slider ranges", () => {
    const low = decodeState("tab=bin&wall=0.1&iwall=0&sc=-3").bin;
    expect([low.wall, low.innerWall, low.scoop]).toEqual([0.8, 0.4, 0]);
    const high = decodeState("tab=bin&wall=9&iwall=7&sc=4").bin;
    expect([high.wall, high.innerWall, high.scoop]).toEqual([2.4, 2, 1]);
    const snapped = decodeState("tab=bin&wall=1.26&iwall=0.84&sc=0.183").bin;
    expect([snapped.wall, snapped.innerWall, snapped.scoop]).toEqual([1.3, 0.8, 0.18]);
    const fallback = decodeState("tab=bin&wall=abc").bin;
    expect([fallback.wall, fallback.innerWall, fallback.scoop]).toEqual([1.2, 0.8, 0.18]);
  });

  it("reads hole patterns and lip styles, including old yes/no links", () => {
    const named = decodeState("tab=bin&bmag=corner&bscr=full&lip=thin").bin;
    expect([named.magnets, named.screws, named.lip]).toEqual(["corner", "full", "thin"]);
    const legacy = decodeState("tab=bin&bmag=1&bscr=0&lip=0").bin;
    expect([legacy.magnets, legacy.screws, legacy.lip]).toEqual(["full", "none", "none"]);
    const junk = decodeState("tab=bin&bmag=lots&lip=tall").bin;
    expect([junk.magnets, junk.lip]).toEqual(["full", "default"]);
  });

  it("decodes links made before dividers and label text with none of either", () => {
    const old = decodeState("tab=bin&bx=2&by=1&bz=3&label=center&wall=1.2");
    expect(old.bin.dividersX).toBe(0);
    expect(old.bin.dividersY).toBe(0);
    expect(old.bin.dividerHeight).toBe(100);
    expect(old.bin.labelText).toBe("");
  });

  it("clamps divider counts and cleans label text", () => {
    const state = decodeState("dvx=40&dvy=-3&dvt=9&dvh=3&lt=hello%20world%21%21%20and%20more");
    expect(state.bin.dividersX).toBe(11);
    expect(state.bin.dividersY).toBe(0);
    expect(state.bin.dividerWall).toBe(2);
    expect(state.bin.dividerHeight).toBe(10);
    expect(state.bin.labelText).toBe("HELLO WORLD ");
  });
});
