import { beforeAll, describe, expect, it } from "vitest";
import type { ManifoldToplevel } from "manifold-3d";
import { loadManifold } from "@/lib/geometry/manifold";
import { buildJob } from "@/lib/geometry/build";
import type { GeometryJob, MeshPart } from "@/lib/geometry/protocol";
import { DEFAULT_BIN, DEFAULT_STATE } from "@/lib/params";

let wasm: ManifoldToplevel;
beforeAll(async () => {
  wasm = await loadManifold();
});

type Tri = { a: number[]; b: number[]; c: number[]; n: number[]; d: number; area: number };

function tris(part: MeshPart): Tri[] {
  const p = part.positions;
  const out: Tri[] = [];
  for (let i = 0; i < part.indices.length; i += 3) {
    const v = [0, 1, 2].map((k) => {
      const j = part.indices[i + k] * 3;
      return [p[j], p[j + 1], p[j + 2]];
    });
    const u = v[1].map((x, k) => x - v[0][k]);
    const w = v[2].map((x, k) => x - v[0][k]);
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const len = Math.hypot(...cr);
    if (len < 1e-6) continue;
    const n = cr.map((x) => x / len);
    out.push({ a: v[0], b: v[1], c: v[2], n, d: n[0] * v[0][0] + n[1] * v[0][1] + n[2] * v[0][2], area: len / 2 });
  }
  return out;
}

function inside(t: Tri, q: number[]) {
  const sign = (p1: number[], p2: number[]) => {
    const u = p2.map((x, k) => x - p1[k]);
    const w = q.map((x, k) => x - p1[k]);
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    return cr[0] * t.n[0] + cr[1] * t.n[1] + cr[2] * t.n[2];
  };
  const e = -1e-4;
  return sign(t.a, t.b) > e && sign(t.b, t.c) > e && sign(t.c, t.a) > e;
}

/** Area of A's faces lying on a face of B that points the same way (both visible: z-fighting). */
export function sharedVisibleArea(A: MeshPart, B: MeshPart) {
  const tb = tris(B);
  const key = (t: Tri) => `${t.n.map((x) => Math.round(x * 100)).join(",")}|${Math.round(t.d * 50)}`;
  const map = new Map<string, Tri[]>();
  for (const t of tb) {
    const k = key(t);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  let area = 0;
  for (const t of tris(A)) {
    const list = map.get(key(t));
    if (!list) continue;
    const q = [0, 1, 2].map((k) => (t.a[k] + t.b[k] + t.c[k]) / 3);
    if (list.some((s) => inside(s, q))) area += t.area;
  }
  return area;
}

/** Thin slivers: parts whose volume is tiny relative to surface. */
function worstOverlap(parts: MeshPart[]) {
  let worst = 0;
  for (let i = 0; i < parts.length; i++)
    for (let j = 0; j < parts.length; j++) if (i !== j) worst = Math.max(worst, sharedVisibleArea(parts[i], parts[j]));
  return worst;
}

const cases: [string, GeometryJob][] = [
  ["bin", { kind: "bin", params: { ...DEFAULT_BIN, gridX: 2, gridY: 2, gridZ: 4 }, paint: true }],
  ["bin dividers", { kind: "bin", params: { ...DEFAULT_BIN, gridX: 2, gridY: 2, gridZ: 4, dividersX: 1 }, paint: true } as GeometryJob],
  ["baseplate 6x4", { kind: "baseplate", params: { ...DEFAULT_STATE.plate, width: 252, depth: 168 }, paint: true } as GeometryJob],
  ["lid", { kind: "lid", gridX: 2, gridY: 2, params: DEFAULT_STATE.lid, paint: true } as GeometryJob],
];

describe("paint parts have no z-fighting faces", () => {
  for (const [name, job] of cases) {
    it(name, () => {
      const parts = buildJob(wasm, job, "preview").filter((p) => p.region);
      expect(parts.length).toBeGreaterThan(0);
      expect(worstOverlap(parts)).toBeLessThan(0.01);
    });
  }
});
