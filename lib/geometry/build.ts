import type { Manifold, ManifoldToplevel } from "manifold-3d";
import {
  binCavityHeight,
  binFootprint,
  fitDividers,
  planBaseplate,
} from "@/lib/fit";
import { cleanLabelText, textPixels, textRects } from "@/lib/geometry/pixel-font";
import type { BinElement, InnerWall } from "@/lib/elements";
import {
  clipCount,
  clipOutline,
  connectorSites,
  socketOutline,
  tabOutline,
  type Point,
} from "@/lib/geometry/connectors";
import type { BaseplateParams, BinParams, LidParams } from "@/lib/params";
import type { GeometryJob, MeshPart, Quality } from "@/lib/geometry/protocol";
import { radii, roundedRectPoints, type Radii } from "@/lib/geometry/shape";
import {
  BASE_HEIGHT_MM,
  BASE_PROFILE_HEIGHT_MM,
  BASE_TOP_MM,
  BASE_TOP_RADIUS_MM,
  CELL_INSET_MM,
  CLIP_HALF_LENGTH_MM,
  CLIP_POCKET_HEIGHT_MM,
  CLIP_THICKNESS_MM,
  DOVETAIL_HEAD_MM,
  PUZZLE_DEPTH_MM,
  HOLE_FROM_CELL_EDGE_MM,
  LID_NOTCH_DEPTH_MM,
  LID_NOTCH_HEIGHT_MM,
  LID_NOTCH_WIDTH_MM,
  LID_PLATE_MM,
  MAGNET_HOLE_DEPTH_MM,
  MAGNET_HOLE_RADIUS_MM,
  PITCH_MM,
  cellPitch,
  PLATE_CORNER_RADIUS_MM,
  SCREW_HOLE_RADIUS_MM,
  SOCKET_CLEARANCE_MM,
  SOCKET_DEPTH_MM,
  STACKING_LIP_DEPTH_MM,
  STACKING_LIP_HEIGHT_MM,
  TAB_DEPTH_MM,
  TAB_HEIGHT_MM,
  TAB_SUPPORT_HEIGHT_MM,
  TAB_WIDTH_NOMINAL_MM,
  WEIGHTED_EXTRA_MM,
  WEIGHT_FINGER_DEPTH_MM,
  WEIGHT_FINGER_LENGTH_MM,
  WEIGHT_FINGER_WIDTH_MM,
  WEIGHT_POCKET_DEPTH_MM,
  WEIGHT_POCKET_MM,
  plateFloorMm,
  BIN_LIMITS,
  LIP_WALL_MM,
  type HolePattern,
} from "@/lib/spec";

type Tessellation = { corner: number; circle: number };

const BASE_STATIONS = [
  { inset: 2.95, z: 0, radius: 0.8 },
  { inset: 2.15, z: 0.8, radius: 1.6 },
  { inset: 2.15, z: 2.6, radius: 1.6 },
  { inset: 0, z: BASE_PROFILE_HEIGHT_MM, radius: BASE_TOP_RADIUS_MM },
] as const;

const LIP_STATIONS = [
  { inset: 0, z: 0 },
  { inset: 0.7, z: 0.7 },
  { inset: 0.7, z: 2.5 },
  { inset: STACKING_LIP_DEPTH_MM, z: STACKING_LIP_HEIGHT_MM },
] as const;

function tessellation(quality: Quality): Tessellation {
  if (quality === "draft") return { corner: 3, circle: 8 };
  return quality === "preview"
    ? { corner: 5, circle: 14 }
    : { corner: 10, circle: 28 };
}

function drop(item: { delete(): void } | null | undefined) {
  if (!item) return;
  try {
    item.delete();
  } catch {
    // Manifold throws if a handle was already released.
  }
}

function unionAll(wasm: ManifoldToplevel, items: Manifold[]): Manifold | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  const result = wasm.Manifold.union(items);
  for (const item of items) drop(item);
  return result;
}

function subtractAll(wasm: ManifoldToplevel, solid: Manifold, cutters: Manifold[]) {
  const cut = unionAll(wasm, cutters);
  if (!cut) return solid;
  const next = solid.subtract(cut);
  drop(solid);
  drop(cut);
  return next;
}

function addAll(wasm: ManifoldToplevel, solid: Manifold, extras: Manifold[]) {
  const extra = unionAll(wasm, extras);
  if (!extra) return solid;
  const next = solid.add(extra);
  drop(solid);
  drop(extra);
  return next;
}

function extrude(
  wasm: ManifoldToplevel,
  x: number,
  y: number,
  w: number,
  d: number,
  corner: Radii,
  z: number,
  height: number,
  segments: number,
): Manifold {
  const cross = new wasm.CrossSection([
    roundedRectPoints(x, y, w, d, corner, segments),
  ]);
  const solid = wasm.Manifold.extrude(cross, height);
  drop(cross);
  if (Math.abs(z) < 1e-9) return solid;
  const moved = solid.translate(0, 0, z);
  drop(solid);
  return moved;
}

function baseProfile(
  wasm: ManifoldToplevel,
  left: number,
  bottom: number,
  zBase: number,
  clearance: number,
  segments: number,
  top = BASE_TOP_MM,
): Manifold {
  const slabs = BASE_STATIONS.map((station, index) => {
    const size = top + clearance * 2 - station.inset * 2;
    const x = left - clearance + station.inset;
    const y = bottom - clearance + station.inset;
    const atTop = index === BASE_STATIONS.length - 1;
    const z = atTop ? zBase + station.z - 0.02 : zBase + station.z;
    return extrude(
      wasm,
      x,
      y,
      size,
      size,
      radii(station.radius + clearance),
      z,
      0.02,
      segments,
    );
  });
  const hull = wasm.Manifold.hull(slabs);
  for (const slab of slabs) drop(slab);
  return hull;
}

function cylinder(
  wasm: ManifoldToplevel,
  radius: number,
  height: number,
  segments: number,
  x: number,
  y: number,
  z: number,
): Manifold {
  const solid = wasm.Manifold.cylinder(height, radius, radius, segments, false);
  const moved = solid.translate(x, y, z);
  drop(solid);
  return moved;
}

function meshFromSolid(
  solid: Manifold,
  name: string,
  placeX = 0,
  placeY = 0,
  placeZ = 0,
): MeshPart {
  const mesh = solid.getMesh();
  const stride = mesh.numProp;
  const count = mesh.vertProperties.length / stride;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = mesh.vertProperties[index * stride];
    positions[index * 3 + 1] = mesh.vertProperties[index * stride + 1];
    positions[index * 3 + 2] = mesh.vertProperties[index * stride + 2];
  }
  return {
    name,
    positions,
    indices: new Uint32Array(mesh.triVerts),
    placeX,
    placeY,
    placeZ,
  };
}

function shiftToOrigin(solid: Manifold): Manifold {
  const box = solid.boundingBox();
  const moved = solid.translate(-box.min[0], -box.min[1], -box.min[2]);
  drop(solid);
  return moved;
}

export function buildBinSolid(
  wasm: ManifoldToplevel,
  params: BinParams,
  quality: Quality,
): Manifold {
  const tess = tessellation(quality);
  wasm.setCircularSegments(tess.circle);
  const wall = Math.min(BIN_LIMITS.wall.max, Math.max(BIN_LIMITS.wall.min, params.wall));
  const footprint = binFootprint(params.gridX, params.gridY);
  const originX = CELL_INSET_MM;
  const originY = CELL_INSET_MM;
  const { body, floorZ, cavity } = binCavityHeight(params.gridZ, wall, params.lite);
  if (footprint.width <= wall * 2 + 2 || footprint.depth <= wall * 2 + 2) {
    throw new Error("Wall thickness leaves no opening inside the bin.");
  }

  const corner = radii(BASE_TOP_RADIUS_MM);
  const pitch = cellPitch(params.half);
  const padTop = pitch - CELL_INSET_MM * 2;
  const cellsX = Math.round((params.gridX * PITCH_MM) / pitch);
  const cellsY = Math.round((params.gridY * PITCH_MM) / pitch);
  const bases: Manifold[] = [];
  for (let ix = 0; ix < cellsX; ix += 1) {
    for (let iy = 0; iy < cellsY; iy += 1) {
      bases.push(
        baseProfile(
          wasm,
          ix * pitch + CELL_INSET_MM,
          iy * pitch + CELL_INSET_MM,
          0,
          0,
          tess.corner,
          padTop,
        ),
      );
    }
  }
  const bridgeHeight = Math.max(0.2, body - BASE_PROFILE_HEIGHT_MM);
  const bridge = extrude(
    wasm,
    originX,
    originY,
    footprint.width,
    footprint.depth,
    corner,
    BASE_PROFILE_HEIGHT_MM,
    bridgeHeight,
    tess.corner,
  );
  let solid = unionAll(wasm, [...bases, bridge]);
  if (!solid) throw new Error("The bin solid came out empty.");

  const cutters: Manifold[] = [];
  if (cavity > 0.4) {
    const innerRadius = Math.max(0.4, BASE_TOP_RADIUS_MM - wall);
    cutters.push(
      extrude(
        wasm,
        originX + wall,
        originY + wall,
        footprint.width - wall * 2,
        footprint.depth - wall * 2,
        radii(innerRadius),
        floorZ,
        cavity + 0.2,
        tess.corner,
      ),
    );
  }

  if (params.lite) {
    const lite = (16 * pitch) / PITCH_MM;
    for (let ix = 0; ix < cellsX; ix += 1) {
      for (let iy = 0; iy < cellsY; iy += 1) {
        const centerX = ix * pitch + pitch / 2;
        const centerY = iy * pitch + pitch / 2;
        cutters.push(
          wasm.Manifold.cube([lite, lite, BASE_PROFILE_HEIGHT_MM - 0.8], false).translate(
            centerX - lite / 2,
            centerY - lite / 2,
            0.8,
          ),
        );
      }
    }
  }

  // Magnets and screws sit on whole 42 mm cells only; half pads are too small
  // for two 6.5 mm holes 8 mm in from each edge.
  const wholeX = Math.floor(params.gridX + 1e-9);
  const wholeY = Math.floor(params.gridY + 1e-9);
  const holes: Manifold[] = [];
  for (let ix = 0; ix < wholeX; ix += 1) {
    for (let iy = 0; iy < wholeY; iy += 1) {
      const xs = [
        ix * PITCH_MM + HOLE_FROM_CELL_EDGE_MM,
        ix * PITCH_MM + PITCH_MM - HOLE_FROM_CELL_EDGE_MM,
      ];
      const ys = [
        iy * PITCH_MM + HOLE_FROM_CELL_EDGE_MM,
        iy * PITCH_MM + PITCH_MM - HOLE_FROM_CELL_EDGE_MM,
      ];
      for (const [ex, x] of xs.entries()) {
        for (const [ey, y] of ys.entries()) {
          // Corner: only the hole nearest each outer corner of the whole bin.
          const outerCorner =
            (ex === 0 ? ix === 0 : ix === wholeX - 1) &&
            (ey === 0 ? iy === 0 : iy === wholeY - 1);
          const wants = (pattern: HolePattern) =>
            pattern === "full" || (pattern === "corner" && outerCorner);
          if (wants(params.magnets)) {
            holes.push(
              cylinder(
                wasm,
                MAGNET_HOLE_RADIUS_MM,
                MAGNET_HOLE_DEPTH_MM + 0.05,
                tess.circle,
                x,
                y,
                -0.02,
              ),
            );
          }
          if (wants(params.screws)) {
            holes.push(
              cylinder(
                wasm,
                SCREW_HOLE_RADIUS_MM,
                BASE_HEIGHT_MM + 1,
                Math.max(10, tess.circle - 4),
                x,
                y,
                -0.2,
              ),
            );
          }
        }
      }
    }
  }
  solid = subtractAll(wasm, solid, [...cutters, ...holes]);

  const innerX = originX + wall;
  const innerY = originY + wall;
  const innerW = footprint.width - wall * 2;
  const innerD = footprint.depth - wall * 2;
  if (cavity > 0.4) {
    const extras = params.elements
      .map((element) =>
        buildElement(wasm, element, {
          innerX,
          innerY,
          innerW,
          innerD,
          floorZ,
          cavity,
          innerWall: Math.min(BIN_LIMITS.innerWall.max, Math.max(BIN_LIMITS.innerWall.min, params.innerWall)),
          scoop: Math.min(1, Math.max(0, params.scoop)),
        }, tess),
      )
      .filter((item): item is Manifold => item != null);
    solid = addAll(wasm, solid, extras);
    const dividers = buildDividers(wasm, params, { innerX, innerY, innerW, innerD, floorZ, cavity });
    solid = addAll(wasm, solid, dividers);
  }

  if (
    params.label !== "none" &&
    cavity >= TAB_HEIGHT_MM + 1 &&
    innerD > 8 &&
    innerW > 8
  ) {
    const depth = Math.min(TAB_DEPTH_MM, innerD - 1);
    if (depth >= 4) {
      const width =
        params.label === "full"
          ? innerW - 0.6
          : Math.min(TAB_WIDTH_NOMINAL_MM, innerW - 0.6);
      let x0 = innerX + (innerW - width) / 2;
      if (params.label === "left") x0 = innerX + 0.3;
      if (params.label === "right") x0 = innerX + innerW - width - 0.3;
      const backY = originY + footprint.depth - wall;
      // With a lip, the lip's sloped inner face starts exactly at z = body. A tab
      // top in that same plane pinches the mesh where the two edges cross (two
      // coincident vertices, which slicers read as non-manifold). Lifting the
      // tab a hair makes the lip cut through it cleanly instead.
      const top = params.lip === "none" ? body : body + TAB_LIP_LIFT_MM;
      const polygon: [number, number][] = [
        [0, 0],
        [0, TAB_HEIGHT_MM],
        [-depth, TAB_HEIGHT_MM],
        [-depth, TAB_HEIGHT_MM - TAB_SUPPORT_HEIGHT_MM],
      ];
      const cross = new wasm.CrossSection([polygon]);
      const extruded = wasm.Manifold.extrude(cross, width);
      drop(cross);
      const tab = extruded.warp((vert) => {
        const x = vert[0];
        const y = vert[1];
        const z = vert[2];
        vert[0] = x0 + z;
        vert[1] = backY + x;
        vert[2] = top - TAB_HEIGHT_MM + y;
      });
      drop(extruded);
      const text = labelText(wasm, params.labelText, { x0, width, backY, depth, top });
      solid = addAll(wasm, solid, text ? [tab, text] : [tab]);
    }
  }

  if (params.lip !== "none") {
    const lip = stackingLip(
      wasm,
      originX,
      originY,
      footprint.width,
      footprint.depth,
      body,
      wall,
      tess.corner,
      LIP_WALL_MM[params.lip],
    );
    solid = addAll(wasm, solid, [lip]);
  }

  if (solid.isEmpty()) {
    drop(solid);
    throw new Error("The bin parameters produced an empty solid.");
  }
  return shiftToOrigin(solid);
}

/** Even X × Y divider walls, fused to the floor and outer walls. */
export function buildDividers(
  wasm: ManifoldToplevel,
  params: Pick<BinParams, "dividersX" | "dividersY" | "dividerWall" | "dividerHeight">,
  box: { innerX: number; innerY: number; innerW: number; innerD: number; floorZ: number; cavity: number },
): Manifold[] {
  const t = Math.min(BIN_LIMITS.dividerWall.max, Math.max(BIN_LIMITS.dividerWall.min, params.dividerWall ?? 0));
  const percent = Math.min(100, Math.max(BIN_LIMITS.dividerHeight.min, params.dividerHeight ?? 100));
  const height = (box.cavity * percent) / 100;
  if (height < 0.5) return [];
  const tall = height + 0.04 + (percent >= 100 ? 0.04 : 0);
  const walls: Manifold[] = [];
  const across = fitDividers(box.innerW, t, params.dividersX ?? 0);
  for (let index = 1; index <= across.count; index += 1) {
    const x = box.innerX + index * across.opening + (index - 1) * t;
    walls.push(wasm.Manifold.cube([t, box.innerD + 0.2, tall], false).translate(x, box.innerY - 0.1, box.floorZ - 0.04));
  }
  const deep = fitDividers(box.innerD, t, params.dividersY ?? 0);
  for (let index = 1; index <= deep.count; index += 1) {
    const y = box.innerY + index * deep.opening + (index - 1) * t;
    walls.push(wasm.Manifold.cube([box.innerW + 0.2, t, tall], false).translate(box.innerX - 0.1, y, box.floorZ - 0.04));
  }
  return walls;
}

/** How far the label tab rises above the body top when a stacking lip sits on it. */
export const TAB_LIP_LIFT_MM = 0.05;

/** Height of raised label text above the tab top. */
export const LABEL_TEXT_RAISE_MM = 0.6;

/**
 * Raised pixel text centered on the flat top of the label tab, reading from
 * the front. Pixel size shrinks to fit the tab, capped at 1 mm.
 */
function labelText(
  wasm: ManifoldToplevel,
  raw: string | undefined,
  tab: { x0: number; width: number; backY: number; depth: number; top: number },
): Manifold | null {
  const text = cleanLabelText(raw ?? "").trimEnd();
  if (!text.trim()) return null;
  const size = textPixels(text.length);
  // Keep clear of the stacking lip, about 3.5 mm in from the outer wall.
  const usableDepth = tab.depth - 4;
  const pixel = Math.min(1, (tab.width - 2) / size.w, usableDepth / size.h);
  if (pixel < 0.35) return null;
  const rects = textRects(text, pixel);
  if (rects.length === 0) return null;
  const left = tab.x0 + (tab.width - size.w * pixel) / 2;
  const bottom = tab.backY - 4 - usableDepth / 2 - (size.h * pixel) / 2;
  // Overlap neighbouring runs a hair so they fuse into one solid.
  const polygons = rects.map((rect): Point[] => {
    const x = left + rect.x - 0.01;
    const y = bottom + rect.y - 0.01;
    const w = rect.w + 0.02;
    const h = rect.h + 0.02;
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  });
  const section = new wasm.CrossSection(polygons, "Positive");
  const solid = wasm.Manifold.extrude(section, LABEL_TEXT_RAISE_MM + 0.02);
  drop(section);
  const moved = solid.translate(0, 0, tab.top - 0.02);
  drop(solid);
  return moved;
}

type Cavity = {
  innerX: number;
  innerY: number;
  innerW: number;
  innerD: number;
  floorZ: number;
  cavity: number;
  /** Wall element thickness. */
  innerWall: number;
  /** Scoop radius as a fraction of the cavity height. */
  scoop: number;
};

/**
 * Extrude a (v, z) profile along one inner wall. v points from the wall into
 * the cavity. Profiles run 0.1 mm past each end so they fuse with the walls.
 */
function alongWall(
  wasm: ManifoldToplevel,
  profile: InstanceType<ManifoldToplevel["CrossSection"]>,
  wall: InnerWall,
  box: Cavity,
): Manifold {
  const span = (wall === "front" || wall === "back" ? box.innerW : box.innerD) + 0.2;
  const extruded = wasm.Manifold.extrude(profile, span);
  // (v, z, along) -> (along, v, z): a cyclic swap, so the mesh keeps its winding.
  const local = extruded.warp((vert) => {
    const v = vert[0];
    const z = vert[1];
    const a = vert[2];
    vert[0] = a;
    vert[1] = v;
    vert[2] = z;
  });
  drop(extruded);
  const turns: Record<InnerWall, { angle: number; x: number; y: number }> = {
    front: { angle: 0, x: box.innerX - 0.1, y: box.innerY },
    back: { angle: 180, x: box.innerX + box.innerW + 0.1, y: box.innerY + box.innerD },
    left: { angle: -90, x: box.innerX, y: box.innerY + box.innerD + 0.1 },
    right: { angle: 90, x: box.innerX + box.innerW, y: box.innerY - 0.1 },
  };
  const turn = turns[wall];
  const rotated = turn.angle === 0 ? local : local.rotate(0, 0, turn.angle);
  if (rotated !== local) drop(local);
  const placed = rotated.translate(turn.x, turn.y, 0);
  drop(rotated);
  return placed;
}

function polygonSection(wasm: ManifoldToplevel, points: Point[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return new wasm.CrossSection([area < 0 ? [...points].reverse() : points]);
}

export function buildElement(
  wasm: ManifoldToplevel,
  element: BinElement,
  box: Cavity,
  tess: Tessellation,
): Manifold | null {
  const { innerX, innerY, innerW, innerD, floorZ, cavity } = box;
  if (element.kind === "wall") {
    const t = Math.min(box.innerWall, (element.along === "y" ? innerW : innerD) - 1);
    if (t < 0.4) return null;
    const height = element.height > 0 ? Math.min(element.height, cavity) : cavity;
    const tall = height + 0.04 + (height >= cavity ? 0.04 : 0);
    const position = Math.min(1, Math.max(0, element.position));
    if (element.along === "y") {
      const x = innerX + position * (innerW - t);
      return wasm.Manifold.cube([t, innerD + 0.2, tall], false).translate(x, innerY - 0.1, floorZ - 0.04);
    }
    const y = innerY + position * (innerD - t);
    return wasm.Manifold.cube([innerW + 0.2, t, tall], false).translate(innerX - 0.1, y, floorZ - 0.04);
  }
  const reach = (element.wall === "front" || element.wall === "back" ? innerD : innerW) - 1;
  if (element.kind === "ledge") {
    const zTop = floorZ + Math.min(element.height, cavity);
    const depth = Math.min(element.depth, reach);
    if (depth < 0.5 || zTop - floorZ < 0.5) return null;
    // 45° underside so the shelf prints without support.
    const bottom = Math.max(floorZ - 0.04, zTop - depth - 0.1);
    const toe = depth - (zTop - bottom);
    const points: Point[] =
      toe > -0.1 + 0.05
        ? [[-0.1, bottom], [toe, bottom], [depth, zTop], [-0.1, zTop]]
        : [[-0.1, bottom], [depth, zTop], [-0.1, zTop]];
    const section = polygonSection(wasm, points);
    const solid = alongWall(wasm, section, element.wall, box);
    drop(section);
    return solid;
  }
  // Scoop: quarter-round fillet filling the floor-to-wall corner.
  const radius = Math.min(box.scoop * cavity, cavity - 0.2, reach);
  if (radius < 1) return null;
  const square = polygonSection(wasm, [
    [-0.1, floorZ - 0.04],
    [radius, floorZ - 0.04],
    [radius, floorZ + radius],
    [-0.1, floorZ + radius],
  ]);
  const circle = wasm.CrossSection.circle(radius, tess.circle * 2);
  const moved = circle.translate([radius, floorZ + radius]);
  const fillet = square.subtract(moved);
  drop(square);
  drop(circle);
  drop(moved);
  const solid = alongWall(wasm, fillet, element.wall, box);
  drop(fillet);
  return solid;
}

/** Loft between neighbouring stations so a concave profile is not chamfered. */
function loft(wasm: ManifoldToplevel, slabs: Manifold[]): Manifold {
  if (slabs.length === 0) throw new Error("Cannot loft an empty profile.");
  if (slabs.length === 1) return slabs[0];
  const segments: Manifold[] = [];
  for (let index = 0; index < slabs.length - 1; index += 1) {
    segments.push(wasm.Manifold.hull([slabs[index], slabs[index + 1]]));
  }
  const solid = unionAll(wasm, segments);
  for (const slab of slabs) drop(slab);
  if (!solid) throw new Error("Profile loft came out empty.");
  return solid;
}

function profileSlab(
  wasm: ManifoldToplevel,
  x: number,
  y: number,
  w: number,
  d: number,
  inset: number,
  z: number,
  segments: number,
): Manifold {
  const sizeW = w - inset * 2;
  const sizeD = d - inset * 2;
  if (sizeW < 0.8 || sizeD < 0.8) {
    throw new Error("Stacking lip does not fit inside this bin.");
  }
  return extrude(
    wasm,
    x + inset,
    y + inset,
    sizeW,
    sizeD,
    radii(Math.max(0.3, BASE_TOP_RADIUS_MM - inset)),
    z,
    0.04,
    segments,
  );
}

function stackingLip(
  wasm: ManifoldToplevel,
  x: number,
  y: number,
  w: number,
  d: number,
  bodyTop: number,
  wall: number,
  segments: number,
  lipWall: number,
): Manifold {
  // Outside matches the standard lip, so a thin lip still takes a stacked bin.
  const outer = LIP_STATIONS.map((station, index) => {
    const atTip = index === LIP_STATIONS.length - 1;
    const z = atTip ? bodyTop + station.z - 0.04 : bodyTop + station.z;
    return profileSlab(wasm, x, y, w, d, station.inset, z, segments);
  });
  const cap = loft(wasm, outer);

  const throat = Math.min(Math.max(wall, 0.8), STACKING_LIP_DEPTH_MM - 0.3);
  const innerStations = [
    { inset: throat, z: bodyTop - 0.3 },
    { inset: 0.7 + lipWall, z: bodyTop + 0.7 },
    { inset: 0.7 + lipWall, z: bodyTop + 2.5 },
    {
      inset: STACKING_LIP_DEPTH_MM + lipWall,
      z: bodyTop + STACKING_LIP_HEIGHT_MM + 0.25,
    },
  ];
  const opening = loft(
    wasm,
    innerStations.map((station) =>
      profileSlab(wasm, x, y, w, d, station.inset, station.z, segments),
    ),
  );
  const ring = cap.subtract(opening);
  drop(cap);
  drop(opening);
  return ring;
}

export function buildBin(
  wasm: ManifoldToplevel,
  params: BinParams,
  quality: Quality,
): MeshPart[] {
  const solid = buildBinSolid(wasm, params, quality);
  try {
    return [
      meshFromSolid(
        solid,
        `bin-${params.gridX}x${params.gridY}x${params.gridZ}`,
      ),
    ];
  } finally {
    drop(solid);
  }
}

/**
 * One base-profile plug over the whole footprint: the same insets a bin's
 * outer feet have, so it seats in a stacking lip exactly like a bin does.
 */
function footprintPlug(
  wasm: ManifoldToplevel,
  width: number,
  depth: number,
  segments: number,
): Manifold {
  const slabs = BASE_STATIONS.map((station, index) => {
    const atTop = index === BASE_STATIONS.length - 1;
    return extrude(
      wasm,
      CELL_INSET_MM + station.inset,
      CELL_INSET_MM + station.inset,
      width - station.inset * 2,
      depth - station.inset * 2,
      radii(station.radius),
      atTop ? station.z - 0.02 : station.z,
      0.02,
      segments,
    );
  });
  const hull = wasm.Manifold.hull(slabs);
  for (const slab of slabs) drop(slab);
  return hull;
}

/** Height of a lid: plug, solid plate, then baseplate sockets on top. */
export function lidHeight() {
  return BASE_PROFILE_HEIGHT_MM + LID_PLATE_MM + SOCKET_DEPTH_MM;
}

/**
 * Stackable lid for a bin of gridX × gridY cells. The underside is a
 * base-profile plug that drops into the bin's stacking lip; the top is a
 * baseplate grid (one socket per cell) so another bin stacks on it.
 * Coordinates match buildBinSolid: cell (0, 0) starts at the origin.
 */
export function buildLidSolid(
  wasm: ManifoldToplevel,
  gridX: number,
  gridY: number,
  params: LidParams,
  quality: Quality,
  half = false,
): Manifold {
  const tess = tessellation(quality);
  wasm.setCircularSegments(tess.circle);
  const footprint = binFootprint(gridX, gridY);
  const pitch = cellPitch(half);
  const cellsX = Math.round((gridX * PITCH_MM) / pitch);
  const cellsY = Math.round((gridY * PITCH_MM) / pitch);
  const plug = footprintPlug(wasm, footprint.width, footprint.depth, tess.corner);
  const socketFloorZ = BASE_PROFILE_HEIGHT_MM + LID_PLATE_MM;
  // The top is full pitch like a baseplate so every socket gets the standard
  // 0.25 mm rim; it overhangs the bin wall by 0.25 mm a side.
  const top = extrude(
    wasm,
    0,
    0,
    gridX * PITCH_MM,
    gridY * PITCH_MM,
    radii(BASE_TOP_RADIUS_MM + CELL_INSET_MM),
    BASE_PROFILE_HEIGHT_MM - 0.01,
    LID_PLATE_MM + SOCKET_DEPTH_MM + 0.01,
    tess.corner,
  );
  let solid = wasm.Manifold.union(plug, top);
  drop(plug);
  drop(top);
  const cutters: Manifold[] = [];
  for (let ix = 0; ix < cellsX; ix += 1) {
    for (let iy = 0; iy < cellsY; iy += 1) {
      cutters.push(
        socketCutter(
          wasm,
          ix * pitch + CELL_INSET_MM,
          iy * pitch + CELL_INSET_MM,
          socketFloorZ,
          true,
          tess,
          pitch - CELL_INSET_MM * 2,
        ),
      );
    }
  }
  if (params.notch) {
    // Elliptical scallop in the front edge, centred on the plug/plate seam,
    // so a fingertip gets under the lid where it meets the bin's lip.
    const round = wasm.Manifold.cylinder(LID_NOTCH_DEPTH_MM + 1, 1, 1, tess.circle, false);
    const turned = round.rotate([-90, 0, 0]);
    const shaped = turned.scale([LID_NOTCH_WIDTH_MM / 2, 1, LID_NOTCH_HEIGHT_MM / 2]);
    cutters.push(shaped.translate((gridX * PITCH_MM) / 2, -1, BASE_PROFILE_HEIGHT_MM));
    drop(round);
    drop(turned);
    drop(shaped);
  }
  solid = subtractAll(wasm, solid, cutters);
  return solid;
}

export function buildLid(
  wasm: ManifoldToplevel,
  gridX: number,
  gridY: number,
  params: LidParams,
  quality: Quality,
  half = false,
): MeshPart[] {
  const solid = buildLidSolid(wasm, gridX, gridY, params, quality, half);
  try {
    return [meshFromSolid(solid, `lid-${gridX}x${gridY}`)];
  } finally {
    drop(solid);
  }
}

function plateCorners(
  piece: { originX: number; originY: number; width: number; depth: number },
  outerW: number,
  outerD: number,
): Radii {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  return {
    bl: near(piece.originX, 0) && near(piece.originY, 0) ? PLATE_CORNER_RADIUS_MM : 0,
    br:
      near(piece.originX + piece.width, outerW) && near(piece.originY, 0)
        ? PLATE_CORNER_RADIUS_MM
        : 0,
    tl:
      near(piece.originX, 0) && near(piece.originY + piece.depth, outerD)
        ? PLATE_CORNER_RADIUS_MM
        : 0,
    tr:
      near(piece.originX + piece.width, outerW) &&
      near(piece.originY + piece.depth, outerD)
        ? PLATE_CORNER_RADIUS_MM
        : 0,
  };
}

/** Socket cutter for one cell. With the floor off it also opens the bottom. */
function socketCutter(
  wasm: ManifoldToplevel,
  baseLeft: number,
  baseBottom: number,
  socketFloorZ: number,
  floorOn: boolean,
  tess: Tessellation,
  top = BASE_TOP_MM,
): Manifold {
  const profile = baseProfile(
    wasm,
    baseLeft,
    baseBottom,
    socketFloorZ,
    SOCKET_CLEARANCE_MM,
    tess.corner,
    top,
  );
  const opener = extrude(
    wasm,
    baseLeft - SOCKET_CLEARANCE_MM,
    baseBottom - SOCKET_CLEARANCE_MM,
    top + SOCKET_CLEARANCE_MM * 2,
    top + SOCKET_CLEARANCE_MM * 2,
    radii(BASE_TOP_RADIUS_MM + SOCKET_CLEARANCE_MM),
    socketFloorZ + BASE_PROFILE_HEIGHT_MM - 0.05,
    1.2,
    tess.corner,
  );
  const parts = [profile, opener];
  if (!floorOn) {
    const bottom = BASE_STATIONS[0];
    parts.push(
      extrude(
        wasm,
        baseLeft - SOCKET_CLEARANCE_MM + bottom.inset,
        baseBottom - SOCKET_CLEARANCE_MM + bottom.inset,
        top + SOCKET_CLEARANCE_MM * 2 - bottom.inset * 2,
        top + SOCKET_CLEARANCE_MM * 2 - bottom.inset * 2,
        radii(bottom.radius + SOCKET_CLEARANCE_MM),
        socketFloorZ - 1,
        1.05,
        tess.corner,
      ),
    );
  }
  const socket = unionAll(wasm, parts);
  if (!socket) throw new Error("Socket cutter came out empty.");
  return socket;
}

function prism(wasm: ManifoldToplevel, points: Point[], z: number, height: number): Manifold {
  const section = polygonSection(wasm, points);
  const solid = wasm.Manifold.extrude(section, height);
  drop(section);
  if (Math.abs(z) < 1e-9) return solid;
  const moved = solid.translate(0, 0, z);
  drop(solid);
  return moved;
}

/** Bowtie clips laid out in a row, one solid. */
export function buildClips(wasm: ManifoldToplevel, count: number): Manifold | null {
  if (count < 1) return null;
  const outline = clipOutline();
  const pitchX = DOVETAIL_HEAD_MM + 4;
  const clips: Manifold[] = [];
  for (let index = 0; index < count; index += 1) {
    const moved: Point[] = outline.map(([x, y]) => [x + index * pitchX, y]);
    clips.push(prism(wasm, moved, 0, CLIP_THICKNESS_MM));
  }
  const all = unionAll(wasm, clips);
  return all ? shiftToOrigin(all) : null;
}

export function buildBaseplate(
  wasm: ManifoldToplevel,
  params: BaseplateParams,
  quality: Quality,
): MeshPart[] {
  const plan = planBaseplate(params);
  if ("error" in plan) throw new Error(plan.error);
  const tess = tessellation(quality);
  wasm.setCircularSegments(tess.circle);
  // Magnets, screws and weights all live in the floor, so no floor means none.
  const floorOn = params.floor !== false;
  const magnets = floorOn && params.magnets;
  const screws = floorOn && params.screws;
  const weightedOn = floorOn && params.style === "weighted";
  const weighted = weightedOn ? WEIGHTED_EXTRA_MM : 0;
  const socketFloorZ = floorOn ? weighted + plateFloorMm(magnets, screws) : 0;
  const totalH = socketFloorZ + SOCKET_DEPTH_MM;
  const connectors = params.connectors ?? "none";
  const edges = params.edges ?? [];
  const pitch = plan.pitch;
  const padTop = pitch - CELL_INSET_MM * 2;
  // Holes and weight pockets need a full 42 mm cell.
  const fullCells = pitch === PITCH_MM;
  const parts: MeshPart[] = [];
  let clipsNeeded = 0;

  for (const piece of plan.pieces) {
    let solid = extrude(
      wasm,
      0,
      0,
      piece.width,
      piece.depth,
      plateCorners(piece, plan.outerW, plan.outerD),
      0,
      totalH,
      tess.corner,
    );
    const sockets: Manifold[] = [];
    const holes: Manifold[] = [];
    const pockets: Manifold[] = [];

    for (let ix = 0; ix < piece.cellsX; ix += 1) {
      for (let iy = 0; iy < piece.cellsY; iy += 1) {
        const cellX = piece.marginLeft + ix * pitch;
        const cellY = piece.marginBottom + iy * pitch;
        sockets.push(
          socketCutter(
            wasm,
            cellX + CELL_INSET_MM,
            cellY + CELL_INSET_MM,
            socketFloorZ,
            floorOn,
            tess,
            padTop,
          ),
        );
        if (!fullCells) continue;

        const centers = [
          cellX + HOLE_FROM_CELL_EDGE_MM,
          cellX + PITCH_MM - HOLE_FROM_CELL_EDGE_MM,
        ];
        const centerYs = [
          cellY + HOLE_FROM_CELL_EDGE_MM,
          cellY + PITCH_MM - HOLE_FROM_CELL_EDGE_MM,
        ];
        for (const x of centers) {
          for (const y of centerYs) {
            if (magnets) {
              holes.push(
                cylinder(
                  wasm,
                  MAGNET_HOLE_RADIUS_MM,
                  MAGNET_HOLE_DEPTH_MM + 0.04,
                  tess.circle,
                  x,
                  y,
                  socketFloorZ - MAGNET_HOLE_DEPTH_MM,
                ),
              );
            }
            if (screws) {
              holes.push(
                cylinder(
                  wasm,
                  SCREW_HOLE_RADIUS_MM,
                  totalH + 0.4,
                  Math.max(10, tess.circle - 4),
                  x,
                  y,
                  -0.2,
                ),
              );
            }
          }
        }

        if (weightedOn) {
          const cx = cellX + PITCH_MM / 2;
          const cy = cellY + PITCH_MM / 2;
          pockets.push(
            wasm.Manifold.cube(
              [WEIGHT_POCKET_MM, WEIGHT_POCKET_MM, WEIGHT_POCKET_DEPTH_MM + 0.02],
              false,
            ).translate(
              cx - WEIGHT_POCKET_MM / 2,
              cy - WEIGHT_POCKET_MM / 2,
              -0.01,
            ),
          );
          const finger = WEIGHT_FINGER_WIDTH_MM;
          const reach = WEIGHT_FINGER_LENGTH_MM;
          pockets.push(
            wasm.Manifold.cube([finger, reach, WEIGHT_FINGER_DEPTH_MM], false).translate(
              cx - finger / 2,
              cy - WEIGHT_POCKET_MM / 2 - reach,
              0,
            ),
            wasm.Manifold.cube([finger, reach, WEIGHT_FINGER_DEPTH_MM], false).translate(
              cx - finger / 2,
              cy + WEIGHT_POCKET_MM / 2,
              0,
            ),
            wasm.Manifold.cube([reach, finger, WEIGHT_FINGER_DEPTH_MM], false).translate(
              cx - WEIGHT_POCKET_MM / 2 - reach,
              cy - finger / 2,
              0,
            ),
            wasm.Manifold.cube([reach, finger, WEIGHT_FINGER_DEPTH_MM], false).translate(
              cx + WEIGHT_POCKET_MM / 2,
              cy - finger / 2,
              0,
            ),
          );
        }
      }
    }

    // Connectors: male tabs are added, then trimmed by the neighbour's sockets
    // so they only fill the wall they slot into. Sockets and clip pockets cut.
    const sites = connectorSites(piece, plan, connectors, edges);
    const tabs: Manifold[] = [];
    const cuts: Manifold[] = [];
    for (const site of sites) {
      if (connectors === "clips") {
        cuts.push(
          prism(wasm, socketOutline(site, CLIP_HALF_LENGTH_MM), -0.5, CLIP_POCKET_HEIGHT_MM + 0.5),
        );
        continue;
      }
      if (site.gender === "female") {
        cuts.push(prism(wasm, socketOutline(site, PUZZLE_DEPTH_MM), -0.5, totalH + 1));
        continue;
      }
      tabs.push(prism(wasm, tabOutline(site), 0, totalH));
      const offset = site.neighbourMargin + CELL_INSET_MM;
      for (const shift of [-pitch, 0]) {
        const along = site.along + shift + CELL_INSET_MM;
        cuts.push(
          site.edge === "right"
            ? socketCutter(wasm, site.at + offset, along, socketFloorZ, floorOn, tess, padTop)
            : socketCutter(wasm, along, site.at + offset, socketFloorZ, floorOn, tess, padTop),
        );
      }
    }
    if (connectors === "clips") clipsNeeded += clipCount(sites);

    solid = addAll(wasm, solid, tabs);
    solid = subtractAll(wasm, solid, [...sockets, ...holes, ...pockets, ...cuts]);
    if (solid.isEmpty()) {
      drop(solid);
      throw new Error(`Baseplate piece ${piece.index} came out empty.`);
    }
    try {
      parts.push(meshFromSolid(solid, `baseplate-${piece.index}`, piece.originX, piece.originY, 0));
    } finally {
      drop(solid);
    }
  }

  const clips = buildClips(wasm, clipsNeeded);
  if (clips) {
    try {
      parts.push(meshFromSolid(clips, `clips-x${clipsNeeded}`, plan.outerW + 12, 0, 0));
    } finally {
      drop(clips);
    }
  }

  return parts;
}

/** Each part (baseplate, bin, lid) builds and exports on its own. */
export function buildJob(wasm: ManifoldToplevel, job: GeometryJob, quality: Quality): MeshPart[] {
  if (job.kind === "bin") return buildBin(wasm, job.params, quality);
  if (job.kind === "lid") return buildLid(wasm, job.gridX, job.gridY, job.params, quality, job.half);
  return buildBaseplate(wasm, job.params, quality);
}
