import * as THREE from "three";
import type { MeshPart } from "@/lib/geometry/protocol";
import type { PreviewQuality } from "@/lib/preview-quality";

/** Faces meeting at more than this angle get a hard edge instead of blended normals. */
export const CREASE_ANGLE = (30 * Math.PI) / 180;

/** Within ~0.26 degrees of a principal axis. */
const AXIS_ALIGNED = 0.99999;

/** Manifold space (Z up) to three.js space (Y up), with the part's placement applied. */
export function toYUp(part: MeshPart) {
  const count = part.positions.length / 3;
  const positions = new Float32Array(part.positions.length);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = part.positions[index * 3] + part.placeX;
    positions[index * 3 + 1] = part.positions[index * 3 + 2] + part.placeZ;
    positions[index * 3 + 2] = -(part.positions[index * 3 + 1] + part.placeY);
  }
  return positions;
}

/**
 * Crease-aware smooth normals for a non-indexed triangle soup, like three's
 * toCreasedNormals (faces within the crease angle blend, sharper edges stay
 * hard). Axis-aligned faces, the floors and walls of a Gridfinity part, keep
 * their exact face normal: blending them with a neighbouring fillet facet
 * tilts one corner of a long thin triangle and paints a diagonal seam.
 */
export function creasedNormals(positions: Float32Array, creaseAngle = CREASE_ANGLE) {
  const faces = positions.length / 9;
  const unit = new Float64Array(faces * 3);
  for (let face = 0; face < faces; face += 1) {
    const o = face * 9;
    const ux = positions[o + 3] - positions[o];
    const uy = positions[o + 4] - positions[o + 1];
    const uz = positions[o + 5] - positions[o + 2];
    const vx = positions[o + 6] - positions[o];
    const vy = positions[o + 7] - positions[o + 1];
    const vz = positions[o + 8] - positions[o + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    unit.set([nx / length, ny / length, nz / length], face * 3);
  }
  const key = (index: number) =>
    `${Math.round(positions[index * 3] * 1e4)},${Math.round(positions[index * 3 + 1] * 1e4)},${Math.round(positions[index * 3 + 2] * 1e4)}`;
  const incident = new Map<string, number[]>();
  for (let index = 0; index < faces * 3; index += 1) {
    const id = key(index);
    const list = incident.get(id);
    if (list) list.push(Math.floor(index / 3));
    else incident.set(id, [Math.floor(index / 3)]);
  }
  const limit = Math.cos(creaseAngle);
  const normals = new Float32Array(positions.length);
  for (let index = 0; index < faces * 3; index += 1) {
    const face = Math.floor(index / 3);
    const axis = Math.max(
      Math.abs(unit[face * 3]),
      Math.abs(unit[face * 3 + 1]),
      Math.abs(unit[face * 3 + 2]),
    );
    if (axis > AXIS_ALIGNED) {
      normals.set([unit[face * 3], unit[face * 3 + 1], unit[face * 3 + 2]], index * 3);
      continue;
    }
    let x = 0;
    let y = 0;
    let z = 0;
    for (const other of incident.get(key(index)) ?? []) {
      const dot =
        unit[face * 3] * unit[other * 3] +
        unit[face * 3 + 1] * unit[other * 3 + 1] +
        unit[face * 3 + 2] * unit[other * 3 + 2];
      if (dot < limit) continue;
      x += unit[other * 3];
      y += unit[other * 3 + 1];
      z += unit[other * 3 + 2];
    }
    const length = Math.hypot(x, y, z);
    if (length === 0) {
      x = unit[face * 3];
      y = unit[face * 3 + 1];
      z = unit[face * 3 + 2];
    } else {
      x /= length;
      y /= length;
      z /= length;
    }
    normals.set([x, y, z], index * 3);
  }
  return normals;
}

/**
 * Manifold shares a vertex between every face that touches it, so plain
 * computeVertexNormals averages a floor's normal with the walls around it and
 * long thin triangles show the tilt as a diagonal seam. Split the normals at
 * creases (high) or give every triangle its own normal (low poly).
 */
export function previewGeometry(part: MeshPart, quality: PreviewQuality) {
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.BufferAttribute(toYUp(part), 3));
  indexed.setIndex(new THREE.BufferAttribute(part.indices, 1));
  if (quality === "high") {
    const creased = indexed.toNonIndexed();
    indexed.dispose();
    creased.setAttribute(
      "normal",
      new THREE.BufferAttribute(creasedNormals(creased.getAttribute("position").array as Float32Array), 3),
    );
    return creased;
  }
  const flat = indexed.toNonIndexed();
  indexed.dispose();
  flat.computeVertexNormals();
  return flat;
}
