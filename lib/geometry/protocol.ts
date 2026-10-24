import type { BaseplateParams, BinParams } from "@/lib/params";

/** "draft" is the coarse low-poly viewer mesh; "export" is what STL/3MF get. */
export type Quality = "draft" | "preview" | "export";

export type MeshPart = {
  name: string;
  positions: Float32Array;
  indices: Uint32Array;
  /** Drawer-space translation so the preview shows the assembled fit. */
  placeX: number;
  placeY: number;
  placeZ: number;
};

export type GeometryJob =
  | { kind: "bin"; params: BinParams }
  | { kind: "baseplate"; params: BaseplateParams };

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
