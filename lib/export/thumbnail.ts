import { zlibSync } from "fflate";
import type { MeshPart } from "@/lib/geometry/protocol";
import { slotOf, type Paint, type Palette } from "@/lib/paint";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimal RGBA PNG encoder. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  header.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlibSync(raw, { level: 6 })),
    chunk("IEND", new Uint8Array()),
  ];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

function rgbOf(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Software-rendered 3/4 view of the parts (same camera angle as the studio's
 * perspective view), flat shaded in each region's AMS colour, transparent
 * background. Runs anywhere (browser, worker, node) so tests can check it.
 */
export function renderThumbnail(parts: MeshPart[], paint: Paint, palette: Palette, size = 512): Uint8Array {
  const yaw = -Math.PI / 4;
  const pitch = (55 * Math.PI) / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // World (x right, y back, z up) -> view (u right, v up, d toward camera).
  const project = (x: number, y: number, z: number) => {
    const rx = x * cy - y * sy;
    const ry = x * sy + y * cy;
    return [rx, z * sp + ry * cp, -ry * sp + z * cp] as const;
  };
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const part of parts) {
    const p = part.positions;
    for (let i = 0; i < p.length; i += 3) {
      const [u, v] = project(p[i], p[i + 1], p[i + 2]);
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  const rgba = new Uint8Array(size * size * 4);
  if (!Number.isFinite(minU)) return encodePng(size, size, rgba);
  const margin = size * 0.06;
  const scale = (size - margin * 2) / Math.max(maxU - minU, maxV - minV, 1e-6);
  const offU = (size - (maxU - minU) * scale) / 2;
  const offV = (size - (maxV - minV) * scale) / 2;
  const depth = new Float32Array(size * size).fill(-Infinity);
  const light = (() => {
    const l = [0.35, 0.55, 0.75];
    const n = Math.hypot(...l);
    return l.map((c) => c / n);
  })();

  for (const part of parts) {
    const [r, g, b] = rgbOf(palette[slotOf(paint, part.region) - 1] ?? "#D9D9D9");
    const p = part.positions;
    const idx = part.indices;
    const count = idx.length ? idx.length : p.length / 3;
    const at = (k: number) => (idx.length ? idx[k] : k);
    for (let t = 0; t + 2 < count; t += 3) {
      const a = at(t) * 3, bI = at(t + 1) * 3, c = at(t + 2) * 3;
      const A = project(p[a], p[a + 1], p[a + 2]);
      const B = project(p[bI], p[bI + 1], p[bI + 2]);
      const C = project(p[c], p[c + 1], p[c + 2]);
      // View-space normal for shading and back-face culling.
      const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1];
      const ny = e1[2] * e2[0] - e1[0] * e2[2];
      const nz = e1[0] * e2[1] - e1[1] * e2[0];
      const len = Math.hypot(nx, ny, nz) || 1;
      if (nz / len < -1e-6) continue;
      const shade = 0.45 + 0.55 * Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / len);
      const sx = (q: readonly number[]) => offU + (q[0] - minU) * scale;
      const syy = (q: readonly number[]) => size - (offV + (q[1] - minV) * scale);
      const x0 = sx(A), y0 = syy(A), x1 = sx(B), y1 = syy(B), x2 = sx(C), y2 = syy(C);
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const xmin = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const xmax = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
      const ymin = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const ymax = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let y = ymin; y <= ymax; y++) {
        for (let x = xmin; x <= xmax; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
          const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const d = w0 * A[2] + w1 * B[2] + w2 * C[2];
          const k = y * size + x;
          if (d <= depth[k]) continue;
          depth[k] = d;
          rgba[k * 4] = Math.min(255, r * shade);
          rgba[k * 4 + 1] = Math.min(255, g * shade);
          rgba[k * 4 + 2] = Math.min(255, b * shade);
          rgba[k * 4 + 3] = 255;
        }
      }
    }
  }
  return encodePng(size, size, rgba);
}
