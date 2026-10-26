import type { BaseplateParams, BinParams, LidParams } from "@/lib/params";

/** "draft" is the coarse low-poly viewer mesh; "export" is what STL/3MF get. */
export type Quality = "draft" | "preview" | "export";

/** A paintable region of one printed body. Each one exports as its own 3MF volume. */
export type PaintRegion =
  | "base"
  | "floor"
  | "wall-front"
  | "wall-back"
  | "wall-left"
  | "wall-right"
  | "dividers"
  | "lip"
  | "lid-body"
  | "lid-grip"
  | "plate-ribs"
  | "plate-floor";

export type MeshPart = {
  name: string;
  /** Set when the job asked for paint regions. */
  region?: PaintRegion;
  /** Regions sharing a group are one printed body (one 3MF object). */
  group?: string;
  positions: Float32Array;
  indices: Uint32Array;
  /** Drawer-space translation so the preview shows the assembled fit. */
  placeX: number;
  placeY: number;
  placeZ: number;
};

export type GeometryJob =
  | { kind: "bin"; params: BinParams; bed?: number; paint?: boolean }
  | { kind: "baseplate"; params: BaseplateParams; paint?: boolean }
  | { kind: "lid"; gridX: number; gridY: number; half?: boolean; bed?: number; params: LidParams; paint?: boolean };

export type WorkerRequest = {
  id: number;
  quality: Quality;
  job: GeometryJob;
};

export type WorkerResponse = {
  id: number;
  ms: number;
  error?: string;
  parts: MeshPart[];
};
