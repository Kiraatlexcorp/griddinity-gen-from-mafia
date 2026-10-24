"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeometryJob, MeshPart, Quality, WorkerRequest, WorkerResponse } from "@/lib/geometry/protocol";

type Waiter = {
  resolve: (parts: MeshPart[]) => void;
  reject: (error: Error) => void;
};

type Result = {
  signature: string;
  parts: MeshPart[];
  ms: number;
  error: string | null;
};

async function renderOnMain(request: WorkerRequest): Promise<WorkerResponse> {
  const started = performance.now();
  try {
    const [{ buildJob }, { loadManifold }] = await Promise.all([
      import("@/lib/geometry/build"),
      import("@/lib/geometry/manifold"),
    ]);
    const wasm = await loadManifold();
    const parts = buildJob(wasm, request.job, request.quality);
    return { id: request.id, ms: performance.now() - started, parts };
  } catch (error) {
    return {
      id: request.id,
      ms: performance.now() - started,
      error: error instanceof Error ? error.message : "Geometry failed.",
      parts: [],
    };
  }
}

export function useGeometry(job: GeometryJob, previewQuality: Quality = "preview") {
  const signature = JSON.stringify([previewQuality, job]);
  const [result, setResult] = useState<Result | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const mainThread = useRef(false);
  const previewId = useRef(0);
  const seq = useRef(0);
  const waiters = useRef(new Map<number, Waiter>());
  const signatures = useRef(new Map<number, string>());
  const jobRef = useRef(job);
  const qualityRef = useRef(previewQuality);

  const apply = useCallback((data: WorkerResponse) => {
    const waiter = waiters.current.get(data.id);
    if (waiter) {
      waiters.current.delete(data.id);
      signatures.current.delete(data.id);
      if (data.error) waiter.reject(new Error(data.error));
      else waiter.resolve(data.parts);
      return;
    }
    if (data.id !== previewId.current) return;
    const drawn = signatures.current.get(data.id) ?? "";
    setResult((current) => ({
      signature: drawn,
      parts: data.error ? (current?.parts ?? []) : data.parts,
      ms: Math.round(data.ms),
      error: data.error ?? null,
    }));
  }, []);

  const send = useCallback(
    (request: WorkerRequest) => {
      if (mainThread.current || !workerRef.current) {
        void renderOnMain(request).then(apply);
        return;
      }
      workerRef.current.postMessage(request);
    },
    [apply],
  );

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../../lib/geometry/geometry.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      mainThread.current = true;
      return;
    }
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      apply(event.data);
    };
    worker.onerror = () => {
      mainThread.current = true;
      worker.terminate();
      workerRef.current = null;
      const id = previewId.current;
      if (id > 0) {
        send({ id, quality: qualityRef.current, job: jobRef.current });
      }
    };
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [apply, send]);

  useEffect(() => {
    const [quality, parsed] = JSON.parse(signature) as [Quality, GeometryJob];
    jobRef.current = parsed;
    qualityRef.current = quality;
    const id = ++seq.current;
    previewId.current = id;
    signatures.current.set(id, signature);
    const timer = window.setTimeout(() => {
      send({ id, quality, job: parsed });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [send, signature]);

  const exportMesh = useCallback(() => {
    const id = ++seq.current;
    const request: WorkerRequest = {
      id,
      quality: "export",
      job: jobRef.current,
    };
    return new Promise<MeshPart[]>((resolve, reject) => {
      waiters.current.set(id, { resolve, reject });
      send(request);
    });
  }, [send]);

  const pending = result?.signature !== signature;
  const status: "error" | "rendering" | "ready" = result?.error && !pending ? "error" : pending ? "rendering" : "ready";

  return {
    parts: result?.parts ?? [],
    status,
    ms: pending ? 0 : (result?.ms ?? 0),
    error: pending ? null : (result?.error ?? null),
    exportMesh,
  };
}
