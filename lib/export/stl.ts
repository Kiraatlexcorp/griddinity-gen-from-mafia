import type { MeshPart } from "@/lib/geometry/protocol";

export function meshToStl(part: MeshPart): Uint8Array {
  const triangles = part.indices.length / 3;
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);
  const header = "Pitch Gridfinity — millimetres";
  for (let index = 0; index < header.length && index < 80; index += 1) {
    view.setUint8(index, header.charCodeAt(index));
  }
  view.setUint32(80, triangles, true);
  const points = part.positions;
  let offset = 84;
  for (let triangle = 0; triangle < triangles; triangle += 1) {
    const a = part.indices[triangle * 3] * 3;
    const b = part.indices[triangle * 3 + 1] * 3;
    const c = part.indices[triangle * 3 + 2] * 3;
    const ax = points[a];
    const ay = points[a + 1];
    const az = points[a + 2];
    const bx = points[b];
    const by = points[b + 1];
    const bz = points[b + 2];
    const cx = points[c];
    const cy = points[c + 1];
    const cz = points[c + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    view.setFloat32(offset, nx, true);
    offset += 4;
    view.setFloat32(offset, ny, true);
    offset += 4;
    view.setFloat32(offset, nz, true);
    offset += 4;
    for (const [x, y, z] of [
      [ax, ay, az],
      [bx, by, bz],
      [cx, cy, cz],
    ] as const) {
      view.setFloat32(offset, x, true);
      offset += 4;
      view.setFloat32(offset, y, true);
      offset += 4;
      view.setFloat32(offset, z, true);
      offset += 4;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

export function stlBounds(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangles = view.getUint32(80, true);
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let offset = 84;
  for (let triangle = 0; triangle < triangles; triangle += 1) {
    offset += 12;
    for (let corner = 0; corner < 3; corner += 1) {
      const x = view.getFloat32(offset, true);
      const y = view.getFloat32(offset + 4, true);
      const z = view.getFloat32(offset + 8, true);
      offset += 12;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    offset += 2;
  }
  return {
    triangles,
    minX,
    minY,
    minZ,
    maxX,
    maxY,
    maxZ,
    width: maxX - minX,
    depth: maxY - minY,
    height: maxZ - minZ,
  };
}
