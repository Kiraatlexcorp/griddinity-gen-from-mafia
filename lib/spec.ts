/**
 * Gridfinity dimensions transcribed from
 * vendor/gridfinity-rebuilt-openscad/src/core/standard.scad (MIT).
 * Gridfinity Studio does not execute that file. See README for the geometry engine.
 */

export const PITCH_MM = 42;
/** Half-grid: 21 mm cells, two per standard cell. Same base profile, smaller pads. */
export const HALF_PITCH_MM = PITCH_MM / 2;

export function cellPitch(half: boolean | undefined): number {
  return half ? HALF_PITCH_MM : PITCH_MM;
}
export const HEIGHT_UNIT_MM = 7;
/** n units span n * 42 - 0.5, so one unit is 41.5 mm. */
export const BIN_CLEARANCE_MM = 0.5;
export const BASE_TOP_MM = 41.5;
export const CELL_INSET_MM = (PITCH_MM - BASE_TOP_MM) / 2;

/** Distance from the 42 mm cell edge to a magnet-hole center. */
export const HOLE_FROM_CELL_EDGE_MM = 8;

export const BASE_PROFILE_HEIGHT_MM = 4.75;
export const BASE_HEIGHT_MM = 7;
export const BASE_TOP_RADIUS_MM = 3.75;
export const BASE_PROFILE_INSET_MM = 2.95;

export const STACKING_LIP_HEIGHT_MM = 4.4;
export const STACKING_LIP_DEPTH_MM = 2.6;

/** Solid layer between a lid's plug and its top sockets. */
export const LID_PLATE_MM = 1.2;
/** Finger notch on the lid's front edge, mm. */
export const LID_NOTCH_WIDTH_MM = 24;
export const LID_NOTCH_HEIGHT_MM = 7;
export const LID_NOTCH_DEPTH_MM = 3;

export const TAB_DEPTH_MM = 15.85;
export const TAB_SUPPORT_HEIGHT_MM = 1.2;
export const TAB_HEIGHT_MM =
  Math.tan((36 * Math.PI) / 180) * TAB_DEPTH_MM + TAB_SUPPORT_HEIGHT_MM;
export const TAB_WIDTH_NOMINAL_MM = 42;

export const MAGNET_HOLE_RADIUS_MM = 6.5 / 2;
export const MAGNET_HOLE_DEPTH_MM = 2.4;
export const SCREW_HOLE_RADIUS_MM = 3 / 2;

export const WALL_DEFAULT_MM = 1.2;
export const WALL_MIN_MM = 0.8;

/** Radial clearance added to each baseplate socket. */
export const SOCKET_CLEARANCE_MM = 0.1;
/** Socket is slightly deeper than the base profile so the lip clears. */
export const SOCKET_EXTRA_DEPTH_MM = 0.1;
export const SOCKET_DEPTH_MM = BASE_PROFILE_HEIGHT_MM + SOCKET_EXTRA_DEPTH_MM;

export const PLATE_FLOOR_PLAIN_MM = 2;
export const PLATE_FLOOR_SCREW_MM = 2.4;
export const PLATE_FLOOR_MAGNET_MM = 2.8;
export const WEIGHTED_EXTRA_MM = 6.4;
export const WEIGHT_POCKET_MM = 21.4;
export const WEIGHT_POCKET_DEPTH_MM = 4;
export const WEIGHT_FINGER_WIDTH_MM = 8.5;
export const WEIGHT_FINGER_LENGTH_MM = 4.25;
export const WEIGHT_FINGER_DEPTH_MM = 2;

export const PLATE_CORNER_RADIUS_MM = 3;

export const BED_A1_MM = 256;
export const BED_A1_MINI_MM = 180;

export type BedPreset = "a1" | "mini" | "p1s" | "custom";

export const BED_PRESETS: { id: BedPreset; label: string; bed: number }[] = [
  { id: "a1", label: "A1", bed: BED_A1_MM },
  { id: "mini", label: "A1 mini", bed: BED_A1_MINI_MM },
  { id: "p1s", label: "P1S / X1C", bed: BED_A1_MM },
  { id: "custom", label: "Custom", bed: BED_A1_MM },
];

export type PlateStyle = "plain" | "weighted";

export function plateFloorMm(magnets: boolean, screws: boolean): number {
  if (magnets) return PLATE_FLOOR_MAGNET_MM;
  if (screws) return PLATE_FLOOR_SCREW_MM;
  return PLATE_FLOOR_PLAIN_MM;
}

export function plateThicknessMm(
  style: PlateStyle,
  magnets: boolean,
  screws: boolean,
): number {
  const weighted = style === "weighted" ? WEIGHTED_EXTRA_MM : 0;
  return weighted + plateFloorMm(magnets, screws) + SOCKET_DEPTH_MM;
}

/* ── Baseplate connectors ────────────────────────────────────────────────
 * Connectors sit on the grid lines between cells along an edge. There the
 * wall between two neighbouring sockets is solid for about ±2.4 mm up to the
 * 2.6 mm profile station, so a dovetail fits with the floor on or off.
 */
export type ConnectorKind = "none" | "clips" | "puzzle";
export type PlateEdge = "left" | "right" | "bottom" | "top";
export const PLATE_EDGES: PlateEdge[] = ["left", "right", "bottom", "top"];

/** Dovetail neck width at the plate edge. */
export const DOVETAIL_NECK_MM = 3.4;
/** Dovetail head width at its far end. */
export const DOVETAIL_HEAD_MM = 4.8;
/** How far a puzzle tab sticks out (and its socket reaches in). */
export const PUZZLE_DEPTH_MM = 3.5;
/** Gap added to every socket and clip pocket, per side. */
export const CONNECTOR_CLEARANCE_MM = 0.2;
/** Clip pocket: half a bowtie cut into the bottom of each plate edge. */
export const CLIP_HALF_LENGTH_MM = 3.5;
export const CLIP_POCKET_HEIGHT_MM = 2.4;
/** Printed clip is the pocket height minus the clearance. */
export const CLIP_THICKNESS_MM = CLIP_POCKET_HEIGHT_MM - CONNECTOR_CLEARANCE_MM;

/** Which base holes a bin gets: none, the 4 outer corners, or 4 per cell. */
export type HolePattern = "none" | "corner" | "full";
export const HOLE_PATTERNS: HolePattern[] = ["none", "corner", "full"];
/** Stacking lip: standard 4.4 mm profile, a thinner wall on the same outside, or a flat top. */
export type LipStyle = "default" | "thin" | "none";
export const LIP_STYLES: LipStyle[] = ["default", "thin", "none"];
export const LIP_WALL_MM: Record<Exclude<LipStyle, "none">, number> = { default: 0.95, thin: 0.5 };

export const BIN_LIMITS = {
  wall: { min: 0.8, max: 2.4, step: 0.1, fallback: 1.2 },
  innerWall: { min: 0.4, max: 2, step: 0.1, fallback: 0.8 },
  scoop: { min: 0, max: 1, step: 0.01, fallback: 0.18 },
  /** Even divider walls across the width / depth. 0 means none. */
  dividers: { min: 0, max: 11, step: 1, fallback: 0 },
  dividerWall: { min: 0.4, max: 2, step: 0.1, fallback: 1.2 },
  /** Divider height as a percentage of the cavity (floor to rim). */
  dividerHeight: { min: 10, max: 100, step: 5, fallback: 100 },
} as const;
