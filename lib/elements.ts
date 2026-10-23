/**
 * Bin interior elements. Walls replace the old even-divider counts and the
 * scoop replaces the old finger-scoop toggle; legacy URLs convert on load.
 */
export type InnerWall = "front" | "back" | "left" | "right";
export const INNER_WALLS: InnerWall[] = ["front", "back", "left", "right"];

export type WallElement = {
  id: number;
  kind: "wall";
  /** Divider runs along this axis: "x" sits at a Y position, "y" at an X position. */
  along: "x" | "y";
  /** Position across the inner opening, 0 to 1. */
  position: number;
  /** Height above the compartment floor. 0 means full height. */
  height: number;
};

export type LedgeElement = {
  id: number;
  kind: "ledge";
  wall: InnerWall;
  /** Top face height above the compartment floor. */
  height: number;
  /** How far the shelf reaches out from the wall. */
  depth: number;
};

export type ScoopElement = {
  id: number;
  kind: "scoop";
  wall: InnerWall;
};

export type BinElement = WallElement | LedgeElement | ScoopElement;
export type ElementKind = BinElement["kind"];

export const ELEMENT_LIMITS = {
  wallHeight: { min: 0, max: 84 },
  ledgeHeight: { min: 2, max: 84 },
  ledgeDepth: { min: 1, max: 30 },
} as const;

export const ELEMENT_LABELS: Record<ElementKind, string> = {
  wall: "Wall",
  ledge: "Ledge",
  scoop: "Scoop",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function nextElementId(elements: BinElement[]) {
  return elements.reduce((max, element) => Math.max(max, element.id), 0) + 1;
}

export function createElement(kind: ElementKind, id: number): BinElement {
  switch (kind) {
    case "wall":
      return { id, kind, along: "y", position: 0.5, height: 0 };
    case "ledge":
      return { id, kind, wall: "back", height: 20, depth: 6 };
    case "scoop":
      return { id, kind, wall: "front" };
  }
}

/** "Wall 1", "Ledge 2"… numbered per kind, in list order. */
export function elementName(elements: BinElement[], element: BinElement) {
  const same = elements.filter((item) => item.kind === element.kind);
  return `${ELEMENT_LABELS[element.kind]} ${same.indexOf(element) + 1}`;
}

/** Even dividers, the shape the old dx / dy sliders produced. */
export function evenWalls(along: "x" | "y", count: number, firstId: number): WallElement[] {
  return Array.from({ length: count }, (_, index) => ({
    id: firstId + index,
    kind: "wall" as const,
    along,
    position: (index + 1) / (count + 1),
    height: 0,
  }));
}

const round = (value: number) => String(Math.round(value * 1000) / 1000);
const WALL_CODE: Record<InnerWall, string> = { front: "f", back: "b", left: "l", right: "r" };
const CODE_WALL = Object.fromEntries(
  Object.entries(WALL_CODE).map(([wall, code]) => [code, wall]),
) as Record<string, InnerWall>;

/**
 * Compact URL form: w-y-0.5-0_l-b-20-6_s-f. Wall thickness and scoop radius
 * are bin-wide (innerWall, scoop); older links that carried them still load.
 */
export function encodeElements(elements: BinElement[]): string {
  return elements
    .map((element) => {
      switch (element.kind) {
        case "wall":
          return ["w", element.along, round(element.position), round(element.height)].join("-");
        case "ledge":
          return ["l", WALL_CODE[element.wall], round(element.height), round(element.depth)].join("-");
        case "scoop":
          return ["s", WALL_CODE[element.wall]].join("-");
      }
    })
    .join("_");
}

export function decodeElements(value: string): BinElement[] {
  const out: BinElement[] = [];
  for (const chunk of value.split("_")) {
    if (!chunk) continue;
    const [code, ...parts] = chunk.split("-");
    const id = out.length + 1;
    if (code === "w" && parts.length >= 3) {
      const along = parts[0] === "x" ? "x" : "y";
      // Legacy links carried a thickness between position and height.
      const position = Number(parts[1]);
      const height = Number(parts[parts.length >= 4 ? 3 : 2]);
      if (![position, height].every(Number.isFinite)) continue;
      out.push({
        id,
        kind: "wall",
        along,
        position: clamp(position, 0, 1),
        height: clamp(height, ELEMENT_LIMITS.wallHeight.min, ELEMENT_LIMITS.wallHeight.max),
      });
    } else if (code === "l" && parts.length >= 3 && CODE_WALL[parts[0]]) {
      const [height, depth] = parts.slice(1).map(Number);
      if (![height, depth].every(Number.isFinite)) continue;
      out.push({
        id,
        kind: "ledge",
        wall: CODE_WALL[parts[0]],
        height: clamp(height, ELEMENT_LIMITS.ledgeHeight.min, ELEMENT_LIMITS.ledgeHeight.max),
        depth: clamp(depth, ELEMENT_LIMITS.ledgeDepth.min, ELEMENT_LIMITS.ledgeDepth.max),
      });
    } else if (code === "s" && parts.length >= 1 && CODE_WALL[parts[0]]) {
      out.push({ id, kind: "scoop", wall: CODE_WALL[parts[0]] });
    }
  }
  return out;
}
