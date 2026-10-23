import type { PlatePiecePlan, PlatePlan } from "@/lib/fit";
import {
  CLIP_HALF_LENGTH_MM,
  CONNECTOR_CLEARANCE_MM,
  DOVETAIL_HEAD_MM,
  DOVETAIL_NECK_MM,
  PITCH_MM,
  PUZZLE_DEPTH_MM,
  type ConnectorKind,
  type PlateEdge,
} from "@/lib/spec";

export type Point = [number, number];

/** Male tabs stick out of right and top edges; left and bottom take sockets. */
export type ConnectorGender = "male" | "female";

export type ConnectorSite = {
  edge: PlateEdge;
  gender: ConnectorGender;
  /** True when the edge is a cut between two bed pieces of the same plate. */
  seam: boolean;
  /** Piece-local position of the grid line along the edge. */
  along: number;
  /** Piece-local coordinate of the edge itself (x for left/right, y for bottom/top). */
  at: number;
  /**
   * Margin the mating neighbour has in front of its first cell, measured
   * from the shared edge. Used to cut the neighbour's sockets out of a tab.
   */
  neighbourMargin: number;
};

export function genderOf(edge: PlateEdge): ConnectorGender {
  return edge === "right" || edge === "top" ? "male" : "female";
}

/**
 * Where connectors go on one bed piece. Outer edges follow the user's pick;
 * seams between pieces always get one so the cut plate rejoins. Sites sit on
 * the inner grid lines of the edge, so an edge one cell long has none.
 */
export function connectorSites(
  piece: PlatePiecePlan,
  plan: Pick<PlatePlan, "pieces" | "marginLeft" | "marginBottom">,
  kind: ConnectorKind,
  edges: PlateEdge[],
): ConnectorSite[] {
  if (kind === "none") return [];
  const lastColumn = Math.max(...plan.pieces.map((item) => item.column));
  const lastRow = Math.max(...plan.pieces.map((item) => item.row));
  const seams: Record<PlateEdge, boolean> = {
    left: piece.column > 0,
    right: piece.column < lastColumn,
    bottom: piece.row > 0,
    top: piece.row < lastRow,
  };
  const sites: ConnectorSite[] = [];
  for (const edge of ["left", "right", "bottom", "top"] as PlateEdge[]) {
    const seam = seams[edge];
    if (!seam && !edges.includes(edge)) continue;
    const vertical = edge === "left" || edge === "right";
    const cells = vertical ? piece.cellsY : piece.cellsX;
    const start = vertical ? piece.marginBottom : piece.marginLeft;
    const at =
      edge === "left" ? 0 : edge === "right" ? piece.width : edge === "bottom" ? 0 : piece.depth;
    const neighbourMargin = seam
      ? 0
      : edge === "right"
        ? plan.marginLeft
        : edge === "top"
          ? plan.marginBottom
          : 0;
    for (let line = 1; line < cells; line += 1) {
      sites.push({
        edge,
        gender: kind === "clips" ? "female" : genderOf(edge),
        seam,
        along: start + line * PITCH_MM,
        at,
        neighbourMargin,
      });
    }
  }
  return sites;
}

/**
 * Dovetail outline in edge space: u runs along the edge, v points away from
 * the plate for a male tab and into it for a socket.
 */
export function dovetailOutline(
  gender: ConnectorGender,
  depth = PUZZLE_DEPTH_MM,
  clearance = CONNECTOR_CLEARANCE_MM,
): Point[] {
  if (gender === "male") {
    const neck = DOVETAIL_NECK_MM / 2;
    const head = DOVETAIL_HEAD_MM / 2;
    // Starts 0.3 mm inside the plate so the union shares volume, not a face.
    return [
      [-neck, -0.3],
      [neck, -0.3],
      [neck, 0],
      [head, depth],
      [-head, depth],
      [-neck, 0],
    ];
  }
  const neck = DOVETAIL_NECK_MM / 2 + clearance;
  const head = DOVETAIL_HEAD_MM / 2 + clearance;
  // Starts 0.5 mm outside the plate so the cut breaks cleanly through the edge.
  return [
    [-neck, -0.5],
    [neck, -0.5],
    [neck, 0],
    [head, depth + clearance],
    [-head, depth + clearance],
    [-neck, 0],
  ];
}

/** Map an edge-space outline to piece-local XY, wound counter-clockwise. */
export function placeOutline(site: Pick<ConnectorSite, "edge" | "along" | "at">, outline: Point[]): Point[] {
  const placed = outline.map(([u, v]): Point => {
    switch (site.edge) {
      case "right":
        return [site.at + v, site.along + u];
      case "left":
        return [site.at - v, site.along + u];
      case "top":
        return [site.along + u, site.at + v];
      case "bottom":
        return [site.along + u, site.at - v];
    }
  });
  // For the female outline v points inward, so flip the sign above.
  return counterClockwise(placed);
}

export function socketOutline(site: ConnectorSite, depth: number): Point[] {
  // A socket points into the plate: reuse placeOutline with v negated.
  const outline = dovetailOutline("female", depth).map(([u, v]): Point => [u, -v]);
  return placeOutline(site, outline);
}

export function tabOutline(site: ConnectorSite): Point[] {
  return placeOutline(site, dovetailOutline("male"));
}

/** Bowtie clip: two male dovetails back to back, nominal size. */
export function clipOutline(): Point[] {
  const neck = DOVETAIL_NECK_MM / 2;
  const head = DOVETAIL_HEAD_MM / 2;
  const half = CLIP_HALF_LENGTH_MM;
  return counterClockwise([
    [-head, -half],
    [head, -half],
    [neck, 0],
    [head, half],
    [-head, half],
    [-neck, 0],
  ]);
}

export function signedArea(points: Point[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function counterClockwise(points: Point[]): Point[] {
  return signedArea(points) < 0 ? [...points].reverse() : points;
}

/** How many clips a plate needs: one per site on a right or top edge. */
export function clipCount(sites: ConnectorSite[]) {
  return sites.filter((site) => site.edge === "right" || site.edge === "top").length;
}
