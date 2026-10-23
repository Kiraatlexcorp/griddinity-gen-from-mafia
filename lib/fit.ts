import type { ConnectorKind, LipStyle, PlateEdge } from "@/lib/spec";
import {
  BASE_HEIGHT_MM,
  BASE_PROFILE_HEIGHT_MM,
  BIN_CLEARANCE_MM,
  HEIGHT_UNIT_MM,
  PITCH_MM,
  PUZZLE_DEPTH_MM,
  STACKING_LIP_HEIGHT_MM,
  SOCKET_DEPTH_MM,
  TAB_HEIGHT_MM,
  plateThicknessMm,
  type PlateStyle,
} from "@/lib/spec";

export type AxisPiece = {
  start: number;
  length: number;
  cellStart: number;
  cellCount: number;
  marginStart: number;
  marginEnd: number;
  /** Puzzle tab sticking out past the far end of this piece. Counts against the bed. */
  overhang: number;
};

export type GridFit = {
  gridX: number;
  gridY: number;
  gridW: number;
  gridD: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginTop: number;
};

export type PlatePiecePlan = {
  index: number;
  column: number;
  row: number;
  originX: number;
  originY: number;
  width: number;
  depth: number;
  cellX: number;
  cellY: number;
  cellsX: number;
  cellsY: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginTop: number;
  /** Puzzle tab reach past the right / top edge, mm. */
  overhangX: number;
  overhangY: number;
};

export type PlatePlan = {
  gridX: number;
  gridY: number;
  outerW: number;
  outerD: number;
  marginLeft: number;
  marginRight: number;
  marginBottom: number;
  marginTop: number;
  thickness: number;
  pieces: PlatePiecePlan[];
};

/**
 * Largest whole grid that fits a drawer, centered.
 * Leftover space is split across the two sides. The right and top sides
 * absorb a half-millimetre when the leftover is odd, so the margins sum
 * to the leftover exactly.
 */
export function fitGrid(
  widthMm: number,
  depthMm: number,
  pitch = PITCH_MM,
): GridFit {
  const gridX = Math.max(0, Math.floor(widthMm / pitch));
  const gridY = Math.max(0, Math.floor(depthMm / pitch));
  const gridW = gridX * pitch;
  const gridD = gridY * pitch;
  const leftoverX = widthMm - gridW;
  const leftoverY = depthMm - gridD;
  const marginLeft = leftoverX / 2;
  const marginBottom = leftoverY / 2;
  return {
    gridX,
    gridY,
    gridW,
    gridD,
    marginLeft,
    marginRight: leftoverX - marginLeft,
    marginBottom,
    marginTop: leftoverY - marginBottom,
  };
}

/**
 * Split one axis into pieces that each fit on the bed.
 * Cuts fall on grid lines. End margins ride on the last piece when they fit,
 * otherwise they drop to the following piece. `overhang.seam` is the male tab
 * every piece before a cut grows on its far side; `overhang.end` is the tab on
 * the plate's own far edge, if that edge has connectors.
 */
export function splitAxis(
  gridCount: number,
  pitch: number,
  marginStart: number,
  marginEnd: number,
  bed: number,
  overhang: { seam: number; end: number } = { seam: 0, end: 0 },
): AxisPiece[] {
  if (gridCount <= 0) return [];
  if (!(bed >= pitch)) {
    throw new Error("Bed is smaller than one grid cell.");
  }

  const pieces: AxisPiece[] = [];
  let cell = 0;
  let cursor = 0;
  let first = true;

  while (cell < gridCount) {
    const lead = first ? marginStart : 0;
    const remaining = gridCount - cell;
    const withEnd = lead + remaining * pitch + marginEnd;
    if (withEnd + overhang.end <= bed + 1e-6) {
      pieces.push({
        start: cursor,
        length: withEnd,
        cellStart: cell,
        cellCount: remaining,
        marginStart: lead,
        marginEnd,
        overhang: overhang.end,
      });
      break;
    }

    let count = Math.floor((bed - lead - overhang.seam) / pitch + 1e-9);
    if (count >= remaining) {
      count = Math.floor((bed - lead - marginEnd - overhang.end) / pitch + 1e-9);
    }
    if (count < 1) {
      throw new Error(
        "A cell plus its margin does not fit on this bed. Use a larger bed or turn padding off.",
      );
    }

    const length = lead + count * pitch;
    pieces.push({
      start: cursor,
      length,
      cellStart: cell,
      cellCount: count,
      marginStart: lead,
      marginEnd: 0,
      overhang: overhang.seam,
    });
    cursor += length;
    cell += count;
    first = false;
  }

  return pieces;
}

export function planBaseplate(input: {
  unit: "mm" | "grid";
  width: number;
  depth: number;
  pad: boolean;
  bed: number;
  style: PlateStyle;
  magnets: boolean;
  screws: boolean;
  floor?: boolean;
  connectors?: ConnectorKind;
  edges?: PlateEdge[];
}): PlatePlan | { error: string } {
  if (!(input.bed >= PITCH_MM)) {
    return { error: "The bed needs at least 42 mm in both directions." };
  }

  let gridX: number;
  let gridY: number;
  let marginLeft = 0;
  let marginRight = 0;
  let marginBottom = 0;
  let marginTop = 0;
  let outerW: number;
  let outerD: number;

  if (input.unit === "grid") {
    gridX = Math.floor(input.width);
    gridY = Math.floor(input.depth);
    outerW = gridX * PITCH_MM;
    outerD = gridY * PITCH_MM;
  } else {
    const fit = fitGrid(input.width, input.depth);
    gridX = fit.gridX;
    gridY = fit.gridY;
    if (input.pad) {
      marginLeft = fit.marginLeft;
      marginRight = fit.marginRight;
      marginBottom = fit.marginBottom;
      marginTop = fit.marginTop;
      outerW = input.width;
      outerD = input.depth;
    } else {
      outerW = fit.gridW;
      outerD = fit.gridD;
    }
  }

  if (gridX < 1 || gridY < 1) {
    return {
      error: "Nothing fits. A drawer needs at least 42 mm in both directions.",
    };
  }

  // Puzzle tabs stick out of right and top edges (seams and picked outer
  // edges). Clips sit in pockets cut into the plate, so they add nothing.
  const puzzle = input.connectors === "puzzle";
  const edges = input.edges ?? [];
  const tab = (crossCells: number, edge: PlateEdge) => {
    const seam = puzzle && crossCells > 1 ? PUZZLE_DEPTH_MM : 0;
    return { seam, end: edges.includes(edge) ? seam : 0 };
  };

  let columns: AxisPiece[];
  let rows: AxisPiece[];
  try {
    columns = splitAxis(gridX, PITCH_MM, marginLeft, marginRight, input.bed, tab(gridY, "right"));
    rows = splitAxis(gridY, PITCH_MM, marginBottom, marginTop, input.bed, tab(gridX, "top"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not split the plate.",
    };
  }

  const pieces: PlatePiecePlan[] = [];
  let index = 1;
  rows.forEach((row, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      pieces.push({
        index: index++,
        column: columnIndex,
        row: rowIndex,
        originX: column.start,
        originY: row.start,
        width: column.length,
        depth: row.length,
        cellX: column.cellStart,
        cellY: row.cellStart,
        cellsX: column.cellCount,
        cellsY: row.cellCount,
        marginLeft: column.marginStart,
        marginRight: column.marginEnd,
        marginBottom: row.marginStart,
        marginTop: row.marginEnd,
        overhangX: column.overhang,
        overhangY: row.overhang,
      });
    });
  });

  return {
    gridX,
    gridY,
    outerW,
    outerD,
    marginLeft,
    marginRight,
    marginBottom,
    marginTop,
    thickness:
      input.floor === false
        ? SOCKET_DEPTH_MM
        : plateThicknessMm(input.style, input.magnets, input.screws),
    pieces,
  };
}

export function binFootprint(gridX: number, gridY: number) {
  return {
    width: gridX * PITCH_MM - BIN_CLEARANCE_MM,
    depth: gridY * PITCH_MM - BIN_CLEARANCE_MM,
  };
}

export function binHeight(gridZ: number, lip: LipStyle) {
  return gridZ * HEIGHT_UNIT_MM + (lip === "none" ? 0 : STACKING_LIP_HEIGHT_MM);
}

/** How many divider walls actually fit while leaving a usable opening. */
export function fitDividers(span: number, wall: number, requested: number) {
  const usable = Math.max(0, span);
  let count = Math.max(0, Math.floor(requested));
  while (count > 0) {
    const opening = (usable - count * wall) / (count + 1);
    if (opening >= 8) break;
    count -= 1;
  }
  const opening = count === 0 ? usable : (usable - count * wall) / (count + 1);
  return { count, opening };
}

export function binCavityHeight(gridZ: number, wall: number, lite: boolean) {
  const body = gridZ * HEIGHT_UNIT_MM;
  const floorZ = lite ? BASE_PROFILE_HEIGHT_MM + wall : BASE_HEIGHT_MM;
  return { body, floorZ, cavity: body - floorZ };
}

export function labelTabFits(cavity: number) {
  return cavity >= TAB_HEIGHT_MM + 1;
}
