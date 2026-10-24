import { describe, expect, it } from "vitest";
import { planDrawer, planBaseplate } from "@/lib/fit";
import { DEFAULT_PLATE } from "@/lib/params";

describe("planDrawer", () => {
  it("counts whole 42 mm cells and splits leftover per side", () => {
    const plan = planDrawer(500, 380, true);
    expect(plan.gridX).toBe(11);
    expect(plan.gridY).toBe(9);
    expect(plan.marginLeft + plan.marginRight).toBeCloseTo(500 - 462);
    expect(plan.marginLeft).toBeCloseTo(19);
    expect(plan.marginBottom + plan.marginTop).toBeCloseTo(2);
  });

  it("applies the drawer size with padding, or the bare grid without", () => {
    expect(planDrawer(500, 380, true).apply).toEqual({ unit: "mm", width: 500, depth: 380, pad: true });
    expect(planDrawer(500, 380, false).apply).toEqual({ unit: "mm", width: 462, depth: 378, pad: false });
  });

  it("padded apply makes a baseplate that fills the drawer", () => {
    const plan = planBaseplate({ ...DEFAULT_PLATE, ...planDrawer(500, 380, true).apply });
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.outerW).toBeCloseTo(500);
    expect(plan.outerD).toBeCloseTo(380);
    expect(plan.gridX).toBe(11);
  });

  it("reports zero cells for a drawer smaller than a cell", () => {
    expect(planDrawer(30, 100, true).gridX).toBe(0);
    expect(planDrawer(Number.NaN, 100, true).drawerW).toBe(0);
  });
});
