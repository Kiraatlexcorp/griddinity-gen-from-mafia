import { buildJob } from "@/lib/geometry/build";
import { loadManifold } from "@/lib/geometry/manifold";
import type { WorkerRequest, WorkerResponse } from "@/lib/geometry/protocol";

let pending: ReturnType<typeof loadManifold> | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const started = performance.now();
  const { id, quality, job } = event.data;
  try {
    pending ??= loadManifold();
    const wasm = await pending;
    const parts = buildJob(wasm, job, quality);
    const transfers: Transferable[] = [];
    for (const part of parts) {
      transfers.push(part.positions.buffer, part.indices.buffer);
    }
    const response: WorkerResponse = {
      id,
      ms: performance.now() - started,
      parts,
    };
    self.postMessage(response, { transfer: transfers });
  } catch (error) {
    const response: WorkerResponse = {
      id,
      ms: performance.now() - started,
      error: error instanceof Error ? error.message : "Geometry failed.",
      parts: [],
    };
    self.postMessage(response);
  }
};
