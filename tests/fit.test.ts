import { describe, expect, it } from "vitest";
import { fitGrid, planBaseplate, splitAxis } from "@/lib/fit";
import { plateThicknessMm } from "@/lib/spec";

describe("fitGrid", () => {
  it("centers an 11 by 9 grid in a 500 by 380 mm drawer", () => {
    const fit = fitGrid(500, 380);
    expect(fit.gridX).toBe(11);
    expect(fit.gridY).toBe(9);
    expect(fit.gridW).toBe(462);
    expect(fit.gridD).toBe(378);
    expect(fit.marginLeft).toBe(19);
    expect(fit.marginRight).toBe(19);
    expect(fit.marginBottom).toBe(1);
    expect(fit.marginTop).toBe(1);
  });

  it("gives the extra half millimetre to the far side when leftover is odd", () => {
    const fit = fitGrid(43, 42);
    expect(fit.gridX).toBe(1);
    expect(fit.marginLeft + fit.marginRight).toBe(1);
    expect(fit.marginRight).toBe(0.5);
    expect(fit.marginLeft).toBe(0.5);
  });
});

describe("splitAxis", () => {
  it("splits 11 cells on a 256 mm bed into 6 and 5", () => {
    const pieces = splitAxis(11, 42, 0, 0, 256);
    expect(pieces.map((piece) => piece.length)).toEqual([252, 210]);
    expect(pieces.map((piece) => piece.cellCount)).toEqual([6, 5]);
  });

  it("keeps an exact 252 mm run as one piece on a 256 mm bed", () => {
    const pieces = splitAxis(6, 42, 0, 0, 256);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].length).toBe(252);
  });

  it("splits 11 cells on a 180 mm bed into 4, 4, and 3", () => {
    const pieces = splitAxis(11, 42, 0, 0, 180);
    expect(pieces.map((piece) => piece.cellCount)).toEqual([4, 4, 3]);
    expect(pieces.map((piece) => piece.length)).toEqual([168, 168, 126]);
  });

  it("refuses a bed smaller than one cell", () => {
    expect(() => splitAxis(2, 42, 0, 0, 40)).toThrow(/smaller than one grid cell/);
  });
});

describe("planBaseplate", () => {
  it("splits a padded 500 by 380 mm drawer into six pieces on a 256 mm bed", () => {
    const plan = planBaseplate({
      unit: "mm",
      width: 500,
      depth: 380,
      pad: true,
      bed: 256,
      style: "plain",
      magnets: true,
      screws: false,
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.gridX).toBe(11);
    expect(plan.gridY).toBe(9);
    expect(plan.outerW).toBe(500);
    expect(plan.outerD).toBe(380);
    expect(plan.pieces).toHaveLength(6);
    const widths = [...new Set(plan.pieces.map((piece) => piece.width))].sort(
      (a, b) => b - a,
    );
    const depths = [...new Set(plan.pieces.map((piece) => piece.depth))].sort(
      (a, b) => b - a,
    );
    expect(widths).toEqual([229, 210, 61]);
    expect(depths).toEqual([253, 127]);
    const covered = plan.pieces.reduce((sum, piece) => sum + piece.width * piece.depth, 0);
    expect(covered).toBe(500 * 380);
    expect(plan.thickness).toBe(plateThicknessMm("plain", true, false));
  });

  it("moves the end margin onto a later piece when it will not fit", () => {
    const plan = planBaseplate({
      unit: "mm",
      width: 500,
      depth: 84,
      pad: true,
      bed: 180,
      style: "plain",
      magnets: false,
      screws: false,
    });
    if ("error" in plan) throw new Error(plan.error);
    const widths = plan.pieces.map((piece) => piece.width);
    expect(widths).toEqual([145, 168, 126, 61]);
    expect(widths.reduce((sum, width) => sum + width, 0)).toBe(500);
  });

  it("builds one 6 by 5 plate when the drawer is an exact grid under 256 mm", () => {
    const plan = planBaseplate({
      unit: "grid",
      width: 6,
      depth: 5,
      pad: false,
      bed: 256,
      style: "plain",
      magnets: true,
      screws: true,
    });
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.pieces).toHaveLength(1);
    expect(plan.outerW).toBe(252);
    expect(plan.outerD).toBe(210);
    expect(plan.pieces[0].width).toBe(252);
    expect(plan.pieces[0].depth).toBe(210);
  });

  it("rejects a drawer smaller than one cell", () => {
    const plan = planBaseplate({
      unit: "mm",
      width: 40,
      depth: 200,
      pad: false,
      bed: 256,
      style: "plain",
      magnets: false,
      screws: false,
    });
    expect(plan).toEqual({
      error: "Nothing fits. A drawer needs at least 42 mm in both directions.",
    });
  });
});

describe("puzzle tab overhang", () => {
  const base = { unit: "grid" as const, pad: false, style: "plain" as const, magnets: false, screws: false };

  it("reserves the 3.5 mm seam tab when splitting", () => {
    // 6 cells = 252 mm fits a 255 mm bed bare, but not with a tab on the cut.
    const pieces = splitAxis(11, 42, 0, 0, 255, { seam: 3.5, end: 0 });
    expect(pieces.map((piece) => piece.cellCount)).toEqual([5, 6]);
    for (const piece of pieces) expect(piece.length + piece.overhang).toBeLessThanOrEqual(255);
  });

  it("splits a 6 × 3 puzzle plate whose right-edge tabs would hang off a 254 mm bed", () => {
    const bare = planBaseplate({ ...base, width: 6, depth: 3, bed: 254 });
    const tabbed = planBaseplate({ ...base, width: 6, depth: 3, bed: 254, connectors: "puzzle", edges: ["right"] });
    if ("error" in bare || "error" in tabbed) throw new Error("plan failed");
    expect(bare.pieces).toHaveLength(1);
    expect(tabbed.pieces.length).toBeGreaterThan(1);
    for (const piece of tabbed.pieces) {
      expect(piece.width + piece.overhangX).toBeLessThanOrEqual(254);
      expect(piece.depth + piece.overhangY).toBeLessThanOrEqual(254);
    }
  });

  it("adds nothing for clips, which sit in pockets", () => {
    const plan = planBaseplate({ ...base, width: 6, depth: 3, bed: 254, connectors: "clips", edges: ["left", "right", "bottom", "top"] });
    if ("error" in plan) throw new Error("plan failed");
    expect(plan.pieces).toHaveLength(1);
  });
});
