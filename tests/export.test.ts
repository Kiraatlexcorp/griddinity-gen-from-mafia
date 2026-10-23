import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import type { MeshPart } from "@/lib/geometry/protocol";
import { meshToStl, stlBounds } from "@/lib/export/stl";
import { arrangeOnBed, meshTo3mf } from "@/lib/export/threemf";

function triangle(name: string, width: number, depth: number): MeshPart {
  return {
    name,
    positions: new Float32Array([
      0, 0, 0,
      width, 0, 0,
      width, depth, 2,
      0, depth, 2,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    placeX: 0,
    placeY: 0,
    placeZ: 0,
  };
}

describe("STL", () => {
  it("writes a binary STL whose bounds match the mesh", () => {
    const part = triangle("bin-1x1x1", 41.5, 41.5);
    const bytes = meshToStl(part);
    expect(bytes[0]).toBe("P".charCodeAt(0));
    const bounds = stlBounds(bytes);
    expect(bounds.triangles).toBe(2);
    expect(bounds.width).toBeCloseTo(41.5, 3);
    expect(bounds.depth).toBeCloseTo(41.5, 3);
    expect(bounds.height).toBeCloseTo(2, 3);
    expect(bounds.minZ).toBeCloseTo(0, 3);
  });
});

describe("3MF", () => {
  it("packs a core-spec package in millimetres with one object per part", () => {
    const wide = triangle("baseplate-1", 90, 40);
    const next = triangle("baseplate-2", 80, 40);
    const packed = arrangeOnBed([wide, next], 256, 6);
    expect(packed[0].x).toBe(0);
    expect(packed[1].x).toBeCloseTo(96, 3);

    const bytes = meshTo3mf([wide, next], 256, "Pitch baseplate");
    const files = unzipSync(bytes);
    expect(files["[Content_Types].xml"]).toBeTruthy();
    expect(files["_rels/.rels"]).toBeTruthy();
    const model = strFromU8(files["3D/3dmodel.model"]);
    expect(model).toContain('unit="millimeter"');
    expect(model).toContain(
      'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"',
    );
    expect(model).toContain("<metadata name=\"Application\">Pitch</metadata>");
    expect(model.match(/<object /g)).toHaveLength(2);
    expect(model.match(/<item /g)).toHaveLength(2);
    expect(model).toContain('name="baseplate-1"');
    expect(model).toContain('name="baseplate-2"');
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 0 0 0"');
    expect(model).toContain("96");
  });
});
