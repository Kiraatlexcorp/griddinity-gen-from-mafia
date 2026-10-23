import {
  decodeElements,
  encodeElements,
  evenWalls,
  type BinElement,
} from "@/lib/elements";
import {
  BED_A1_MM,
  BED_PRESETS,
  BIN_LIMITS,
  HOLE_PATTERNS,
  LIP_STYLES,
  type HolePattern,
  type LipStyle,
  PLATE_EDGES,
  type BedPreset,
  type ConnectorKind,
  type PlateEdge,
  type PlateStyle,
} from "@/lib/spec";
import { cleanLabelText } from "@/lib/geometry/pixel-font";

export type StudioTab = "baseplate" | "bin";
export type LengthUnit = "mm" | "grid";
export type LabelPosition = "none" | "left" | "center" | "right" | "full";

export type BaseplateParams = {
  unit: LengthUnit;
  width: number;
  depth: number;
  pad: boolean;
  bedPreset: BedPreset;
  bed: number;
  magnets: boolean;
  screws: boolean;
  style: PlateStyle;
  /** Off leaves only the open socket frame, with no bottom slab. */
  floor: boolean;
  connectors: ConnectorKind;
  /** Outer edges that get connectors. Seams between bed pieces always do. */
  edges: PlateEdge[];
};

export type BinParams = {
  gridX: number;
  gridY: number;
  gridZ: number;
  /** Interior walls, ledges and scoops, in list order. */
  elements: BinElement[];
  label: LabelPosition;
  /** Base magnet pockets, 6.5 × 2.4 mm. Corner is the bin's 4 outer corners only. */
  magnets: HolePattern;
  /** M3 screw holes, same positions as the magnets. */
  screws: HolePattern;
  lip: LipStyle;
  lite: boolean;
  /** Outer wall, 0.8 to 2.4 mm. */
  wall: number;
  /** Wall elements (dividers), 0.4 to 2 mm. */
  innerWall: number;
  /** Scoop radius as a fraction of the cavity height, 0 to 1. */
  scoop: number;
  /** Even divider walls splitting the width into dividersX + 1 columns. */
  dividersX: number;
  /** Even divider walls splitting the depth into dividersY + 1 rows. */
  dividersY: number;
  /** Divider thickness, mm. */
  dividerWall: number;
  /** Divider height, % of the cavity height. */
  dividerHeight: number;
  /** Raised text on the label tab, up to 12 characters. Empty means none. */
  labelText: string;
};

export type StudioState = {
  tab: StudioTab;
  plate: BaseplateParams;
  bin: BinParams;
};

export const DEFAULT_PLATE: BaseplateParams = {
  unit: "mm",
  width: 252,
  depth: 168,
  pad: false,
  bedPreset: "a1",
  bed: BED_A1_MM,
  magnets: true,
  screws: true,
  style: "plain",
  floor: true,
  connectors: "none",
  edges: [...PLATE_EDGES],
};

export const DEFAULT_BIN: BinParams = {
  gridX: 3,
  gridY: 2,
  gridZ: 6,
  elements: [{ id: 1, kind: "scoop", wall: "front" }],
  label: "center",
  magnets: "full",
  screws: "none",
  lip: "default",
  lite: false,
  wall: BIN_LIMITS.wall.fallback,
  innerWall: BIN_LIMITS.innerWall.fallback,
  scoop: BIN_LIMITS.scoop.fallback,
  dividersX: 0,
  dividersY: 0,
  dividerWall: BIN_LIMITS.dividerWall.fallback,
  dividerHeight: BIN_LIMITS.dividerHeight.fallback,
  labelText: "",
};

export const DEFAULT_STATE: StudioState = {
  tab: "baseplate",
  plate: DEFAULT_PLATE,
  bin: DEFAULT_BIN,
};

const EDGE_CODES: Record<PlateEdge, string> = {
  left: "l",
  right: "r",
  bottom: "b",
  top: "t",
};

export function decodeEdges(value: string | null): PlateEdge[] {
  if (value == null) return [...PLATE_EDGES];
  return PLATE_EDGES.filter((edge) => value.includes(EDGE_CODES[edge]));
}

export function encodeEdges(edges: PlateEdge[]): string {
  return PLATE_EDGES.filter((edge) => edges.includes(edge))
    .map((edge) => EDGE_CODES[edge])
    .join("");
}

const CONNECTORS: ConnectorKind[] = ["none", "clips", "puzzle"];

const LABELS: LabelPosition[] = ["none", "left", "center", "right", "full"];

function num(value: string | null, fallback: number, min: number, max: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function bool(value: string | null, fallback: boolean) {
  if (value == null) return fallback;
  return value === "1" || value === "true";
}

/** A named choice, or "1"/"0" from links made when the option was a yes/no. */
function choice<T extends string>(value: string | null, options: readonly T[], on: T, off: T, fallback: T): T {
  if (value == null) return fallback;
  if (value === "1" || value === "true") return on;
  if (value === "0" || value === "false") return off;
  return options.includes(value as T) ? (value as T) : fallback;
}

/** Clamp to the slider range, then snap to the slider step. */
function limit(key: keyof typeof BIN_LIMITS, value: string | null) {
  const { min, max, step, fallback } = BIN_LIMITS[key];
  const snapped = Math.round(num(value, fallback, min, max) / step) * step;
  return clamp(Math.round(snapped * 1000) / 1000, min, max);
}

/** Clamp bin options to their slider ranges and steps. */
export function clampBin(bin: BinParams): BinParams {
  const fit = (key: keyof typeof BIN_LIMITS, value: number) => limit(key, String(value));
  return {
    ...bin,
    wall: fit("wall", bin.wall),
    innerWall: fit("innerWall", bin.innerWall),
    scoop: fit("scoop", bin.scoop),
    dividersX: fit("dividers", bin.dividersX),
    dividersY: fit("dividers", bin.dividersY),
    dividerWall: fit("dividerWall", bin.dividerWall),
    dividerHeight: fit("dividerHeight", bin.dividerHeight),
    labelText: cleanLabelText(bin.labelText),
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Elements from "el", or converted from the legacy dx / dy / scoop keys. */
function readElements(params: URLSearchParams): BinElement[] {
  const raw = params.get("el");
  if (raw != null) return decodeElements(raw);
  if (!params.has("dx") && !params.has("dy") && !params.has("scoop")) {
    return DEFAULT_BIN.elements.map((element) => ({ ...element }));
  }
  const dx = Math.round(num(params.get("dx"), 0, 0, 8));
  const dy = Math.round(num(params.get("dy"), 0, 0, 8));
  const elements: BinElement[] = [
    ...evenWalls("y", dx, 1),
    ...evenWalls("x", dy, dx + 1),
  ];
  if (bool(params.get("scoop"), true)) {
    elements.push({ id: dx + dy + 1, kind: "scoop", wall: "front" });
  }
  return elements;
}

export function decodeState(search: string): StudioState {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") === "bin" ? "bin" : "baseplate";
  const unit = params.get("unit") === "grid" ? "grid" : "mm";
  const presetRaw = params.get("bedp");
  const bedPreset = BED_PRESETS.some((preset) => preset.id === presetRaw)
    ? (presetRaw as BedPreset)
    : "a1";
  const presetBed =
    BED_PRESETS.find((preset) => preset.id === bedPreset)?.bed ?? BED_A1_MM;
  const labelRaw = params.get("label");
  const label = LABELS.includes(labelRaw as LabelPosition)
    ? (labelRaw as LabelPosition)
    : DEFAULT_BIN.label;
  const style = params.get("style") === "weighted" ? "weighted" : "plain";
  const connectorRaw = params.get("conn");
  const connectors = CONNECTORS.includes(connectorRaw as ConnectorKind)
    ? (connectorRaw as ConnectorKind)
    : DEFAULT_PLATE.connectors;

  return {
    tab,
    plate: {
      unit,
      width: num(params.get("w"), unit === "grid" ? 6 : DEFAULT_PLATE.width, 1, 2000),
      depth: num(params.get("d"), unit === "grid" ? 4 : DEFAULT_PLATE.depth, 1, 2000),
      pad: bool(params.get("pad"), DEFAULT_PLATE.pad),
      bedPreset,
      bed: num(params.get("bed"), bedPreset === "custom" ? DEFAULT_PLATE.bed : presetBed, 42, 1000),
      magnets: bool(params.get("pmag"), DEFAULT_PLATE.magnets),
      screws: bool(params.get("pscr"), DEFAULT_PLATE.screws),
      style,
      floor: bool(params.get("floor"), DEFAULT_PLATE.floor),
      connectors,
      edges: decodeEdges(params.get("edges")),
    },
    bin: {
      gridX: Math.round(num(params.get("bx"), DEFAULT_BIN.gridX, 1, 12)),
      gridY: Math.round(num(params.get("by"), DEFAULT_BIN.gridY, 1, 12)),
      gridZ: Math.round(num(params.get("bz"), DEFAULT_BIN.gridZ, 1, 12)),
      elements: readElements(params),
      label,
      magnets: choice<HolePattern>(params.get("bmag"), HOLE_PATTERNS, "full", "none", DEFAULT_BIN.magnets),
      screws: choice<HolePattern>(params.get("bscr"), HOLE_PATTERNS, "full", "none", DEFAULT_BIN.screws),
      lip: choice<LipStyle>(params.get("lip"), LIP_STYLES, "default", "none", DEFAULT_BIN.lip),
      lite: bool(params.get("lite"), DEFAULT_BIN.lite),
      wall: limit("wall", params.get("wall")),
      // Older links had one wall setting that also sized the dividers.
      innerWall: limit("innerWall", params.get("iwall") ?? (params.has("dx") || params.has("dy") ? params.get("wall") : null)),
      scoop: limit("scoop", params.get("sc")),
      dividersX: limit("dividers", params.get("dvx")),
      dividersY: limit("dividers", params.get("dvy")),
      dividerWall: limit("dividerWall", params.get("dvt")),
      dividerHeight: limit("dividerHeight", params.get("dvh")),
      labelText: cleanLabelText(params.get("lt") ?? ""),
    },
  };
}

export function encodeState(state: StudioState): string {
  const params = new URLSearchParams();
  params.set("tab", state.tab);
  params.set("unit", state.plate.unit);
  params.set("w", trim(state.plate.width));
  params.set("d", trim(state.plate.depth));
  params.set("pad", state.plate.pad ? "1" : "0");
  params.set("bedp", state.plate.bedPreset);
  params.set("bed", trim(state.plate.bed));
  params.set("pmag", state.plate.magnets ? "1" : "0");
  params.set("pscr", state.plate.screws ? "1" : "0");
  params.set("style", state.plate.style);
  params.set("floor", state.plate.floor ? "1" : "0");
  params.set("conn", state.plate.connectors);
  params.set("edges", encodeEdges(state.plate.edges));
  params.set("bx", String(state.bin.gridX));
  params.set("by", String(state.bin.gridY));
  params.set("bz", String(state.bin.gridZ));
  params.set("el", encodeElements(state.bin.elements));
  params.set("label", state.bin.label);
  params.set("bmag", state.bin.magnets);
  params.set("bscr", state.bin.screws);
  params.set("lip", state.bin.lip);
  params.set("lite", state.bin.lite ? "1" : "0");
  params.set("wall", trim(state.bin.wall));
  params.set("iwall", trim(state.bin.innerWall));
  params.set("sc", trim(state.bin.scoop));
  params.set("dvx", String(state.bin.dividersX));
  params.set("dvy", String(state.bin.dividersY));
  params.set("dvt", trim(state.bin.dividerWall));
  params.set("dvh", trim(state.bin.dividerHeight));
  if (state.bin.labelText) params.set("lt", state.bin.labelText);
  return params.toString();
}

function trim(value: number) {
  return String(Math.round(value * 100) / 100);
}

export function formatMm(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
}
