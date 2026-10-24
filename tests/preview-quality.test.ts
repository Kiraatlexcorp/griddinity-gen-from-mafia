import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import type { ManifoldToplevel } from "manifold-3d";
import { buildBin } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import { previewGeometry, toYUp } from "@/lib/geometry/preview-mesh";
import type { MeshPart } from "@/lib/geometry/protocol";
import { DEFAULT_BIN, type BinParams } from "@/lib/params";
import { geometryQuality, parsePreviewQuality } from "@/lib/preview-quality";

let wasm: ManifoldToplevel;

beforeAll(async () => {
  wasm = await loadManifold();
});

const bin: BinParams = { ...DEFAULT_BIN, gridX: 2, gridY: 1, gridZ: 3, elements: [] };

/** Worst vertex-normal tilt (1 - dot) on triangles that lie on a flat axis-aligned face. */
function flatFaceDeviation(geometry: THREE.BufferGeometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = flat.getAttribute("position");
  const normal = flat.getAttribute("normal");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const face = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  let worst = 0;
  let checked = 0;
  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index);
    b.fromBufferAttribute(position, index + 1);
    c.fromBufferAttribute(position, index + 2);
    face.crossVectors(b.clone().sub(a), c.clone().sub(a));
    if (face.lengthSq() < 1e-12) continue;
    face.normalize();
    const axis = Math.max(Math.abs(face.x), Math.abs(face.y), Math.abs(face.z));
    if (axis < 0.99999) continue;
    checked += 1;
    for (let corner = 0; corner < 3; corner += 1) {
      vertex.fromBufferAttribute(normal, index + corner);
      worst = Math.max(worst, 1 - vertex.dot(face));
    }
  }
  return { worst, checked };
}

function part(): MeshPart {
  return buildBin(wasm, bin, "export")[0];
}

describe("preview shading", () => {
  it("plain averaged normals tilt flat faces (the seam this fixes)", () => {
    const source = part();
    const naive = new THREE.BufferGeometry();
    naive.setAttribute("position", new THREE.BufferAttribute(toYUp(source), 3));
    naive.setIndex(new THREE.BufferAttribute(source.indices, 1));
    naive.computeVertexNormals();
    expect(flatFaceDeviation(naive).worst).toBeGreaterThan(0.01);
  });

  it("high quality keeps floor and wall normals exactly perpendicular", () => {
    const { worst, checked } = flatFaceDeviation(previewGeometry(part(), "high"));
    expect(checked).toBeGreaterThan(20);
    expect(worst).toBeLessThan(1e-4);
  });

  it("high quality still smooths fillets and magnet holes", () => {
    const source = buildBin(wasm, { ...bin, magnets: "full" } as BinParams, "export")[0];
    const geometry = previewGeometry(source, "high");
    const normal = geometry.getAttribute("normal");
    const position = geometry.getAttribute("position");
    let smoothed = 0;
    const face = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const vertex = new THREE.Vector3();
    for (let index = 0; index < position.count; index += 3) {
      a.fromBufferAttribute(position, index);
      b.fromBufferAttribute(position, index + 1);
      c.fromBufferAttribute(position, index + 2);
      face.crossVectors(b.sub(a), c.sub(a)).normalize();
      vertex.fromBufferAttribute(normal, index);
      if (1 - vertex.dot(face) > 1e-3) smoothed += 1;
    }
    expect(smoothed).toBeGreaterThan(100);
  });

  it("low poly gives every triangle its own flat normal", () => {
    const source = buildBin(wasm, bin, geometryQuality("low"))[0];
    const { worst } = flatFaceDeviation(previewGeometry(source, "low"));
    expect(worst).toBeLessThan(1e-4);
  });
});

describe("preview quality setting", () => {
  it("defaults to high and ignores junk", () => {
    expect(parsePreviewQuality(null)).toBe("high");
    expect(parsePreviewQuality("ultra")).toBe("high");
    expect(parsePreviewQuality("low")).toBe("low");
  });

  it("low poly builds a coarser mesh; high matches the export mesh", () => {
    expect(geometryQuality("high")).toBe("export");
    const params = { ...bin, magnets: "full" } as BinParams;
    const low = buildBin(wasm, params, geometryQuality("low"))[0];
    const high = buildBin(wasm, params, geometryQuality("high"))[0];
    expect(low.indices.length).toBeLessThan(high.indices.length * 0.6);
  });
});
