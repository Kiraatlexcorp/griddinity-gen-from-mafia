import type { ManifoldToplevel } from "manifold-3d";

let singleton: Promise<ManifoldToplevel> | null = null;

export function loadManifold(): Promise<ManifoldToplevel> {
  if (!singleton) {
    singleton = import("manifold-3d").then(async (module) => {
      const inBrowser =
        typeof window !== "undefined" ||
        (typeof globalThis !== "undefined" && "WorkerGlobalScope" in globalThis);
      const wasm = await module.default(
        inBrowser
          ? {
              locateFile: () =>
                new URL("/manifold.wasm", self.location.origin).href,
            }
          : undefined,
      );
      wasm.setup();
      return wasm;
    });
  }
  return singleton;
}
