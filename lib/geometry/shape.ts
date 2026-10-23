export type Radii = { bl: number; br: number; tr: number; tl: number };

export function radii(value: number): Radii {
  return { bl: value, br: value, tr: value, tl: value };
}

export function sharp(): Radii {
  return radii(0);
}

/** CCW rounded rectangle. Zero-radius corners stay sharp. */
export function roundedRectPoints(
  x: number,
  y: number,
  w: number,
  d: number,
  corner: Radii,
  segments: number,
): [number, number][] {
  const limit = Math.max(0, Math.min(w, d) / 2 - 0.01);
  const r = {
    bl: Math.min(Math.max(0, corner.bl), limit),
    br: Math.min(Math.max(0, corner.br), limit),
    tr: Math.min(Math.max(0, corner.tr), limit),
    tl: Math.min(Math.max(0, corner.tl), limit),
  };
  const corners = [
    { cx: x + w - r.br, cy: y + r.br, radius: r.br, a0: -Math.PI / 2, a1: 0 },
    { cx: x + w - r.tr, cy: y + d - r.tr, radius: r.tr, a0: 0, a1: Math.PI / 2 },
    { cx: x + r.tl, cy: y + d - r.tl, radius: r.tl, a0: Math.PI / 2, a1: Math.PI },
    { cx: x + r.bl, cy: y + r.bl, radius: r.bl, a0: Math.PI, a1: (Math.PI * 3) / 2 },
  ];
  const points: [number, number][] = [];
  for (const item of corners) {
    const steps = item.radius < 0.05 ? 1 : Math.max(1, segments);
    for (let i = 0; i < steps; i += 1) {
      const t = item.a0 + ((item.a1 - item.a0) * i) / steps;
      const radius = item.radius < 0.05 ? 0 : item.radius;
      points.push([
        item.cx + radius * Math.cos(t),
        item.cy + radius * Math.sin(t),
      ]);
    }
  }
  return points;
}
