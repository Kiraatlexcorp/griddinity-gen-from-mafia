"use client";

import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import * as THREE from "three";
import type { MeshPart } from "@/lib/geometry/protocol";

const FILAMENT = ["#d4d4d4", "#c8c8c8", "#dcdcdc", "#bdbdbd", "#d0d0d0", "#c4c4c4"];
const FILAMENT_DARK = ["#b8b8b8", "#a8a8a8", "#c4c4c4", "#9c9c9c", "#b0b0b0", "#a2a2a2"];

type Orbit = {
  target: THREE.Vector3;
  update: () => void;
  minDistance: number;
  maxDistance: number;
};

function toYUp(part: MeshPart) {
  const count = part.positions.length / 3;
  const positions = new Float32Array(part.positions.length);
  for (let index = 0; index < count; index += 1) {
    const x = part.positions[index * 3] + part.placeX;
    const y = part.positions[index * 3 + 1] + part.placeY;
    const z = part.positions[index * 3 + 2] + part.placeZ;
    positions[index * 3] = x;
    positions[index * 3 + 1] = z;
    positions[index * 3 + 2] = -y;
  }
  return positions;
}

function PartMesh({ part, color }: { part: MeshPart; color: string }) {
  const geometry = useMemo(() => {
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.BufferAttribute(toYUp(part), 3));
    next.setIndex(new THREE.BufferAttribute(part.indices, 1));
    next.computeVertexNormals();
    return next;
  }, [part]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        roughness={0.72}
        metalness={0.04}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function frameCamera(
  camera: THREE.PerspectiveCamera,
  controls: Orbit | null,
  parts: MeshPart[],
) {
  if (parts.length === 0) return;
  const box = new THREE.Box3();
  for (const part of parts) {
    const points = part.positions;
    for (let index = 0; index < points.length; index += 3) {
      box.expandByPoint(
        new THREE.Vector3(
          points[index] + part.placeX,
          points[index + 2] + part.placeZ,
          -(points[index + 1] + part.placeY),
        ),
      );
    }
  }
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fov = (camera.fov * Math.PI) / 180;
  const distance = (sphere.radius / Math.sin(fov / 2)) * 0.92;
  camera.position
    .copy(sphere.center)
    .add(new THREE.Vector3(0.82, 0.62, 0.95).normalize().multiplyScalar(distance));
  camera.near = Math.max(0.05, distance / 200);
  camera.far = distance * 30;
  camera.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(sphere.center);
    controls.minDistance = Math.max(8, sphere.radius * 0.45);
    controls.maxDistance = sphere.radius * 10;
    controls.update();
  }
}

function Fit({ parts }: { parts: MeshPart[] }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as Orbit | null;

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    frameCamera(camera, controls, parts);
  }, [camera, controls, parts]);

  return null;
}

function useDarkPaper() {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

function CropMarks() {
  const mark = "absolute size-3.5 border-foreground/45";
  return (
    <div className="pointer-events-none absolute inset-3">
      <span className={`${mark} top-0 left-0 border-t border-l`} />
      <span className={`${mark} top-0 right-0 border-t border-r`} />
      <span className={`${mark} bottom-0 left-0 border-b border-l`} />
      <span className={`${mark} right-0 bottom-0 border-r border-b`} />
    </div>
  );
}

export function Preview({
  parts,
  status,
  ms,
  error,
}: {
  parts: MeshPart[];
  status: "rendering" | "ready" | "error";
  ms: number;
  error: string | null;
}) {
  const dark = useDarkPaper();
  const colors = dark ? FILAMENT_DARK : FILAMENT;
  const badge =
    status === "rendering" ? "RENDERING" : status === "error" ? "FAILED" : ms > 0 ? `${ms} ms` : "";

  return (
    <div className="absolute inset-0 bg-background">
      <Canvas
        className="h-full w-full"
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
        camera={{ fov: 32, position: [180, 130, 190], near: 0.1, far: 5000 }}
      >
        <ambientLight intensity={0.72} />
        <directionalLight position={[80, 140, 60]} intensity={1.15} />
        <directionalLight position={[-70, 40, -40]} intensity={0.35} />
        <Grid
          args={[2400, 2400]}
          cellSize={42}
          cellThickness={0.55}
          cellColor={dark ? "#262626" : "#e5e5e5"}
          sectionSize={168}
          sectionThickness={1.05}
          sectionColor={dark ? "#404040" : "#a3a3a3"}
          fadeDistance={1100}
          fadeStrength={1.4}
          infiniteGrid
          position={[0, -0.25, 0]}
        />
        {parts.map((part, index) => (
          <PartMesh key={part.name} part={part} color={colors[index % colors.length]} />
        ))}
        <Fit parts={parts} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.14}
          maxPolarAngle={Math.PI / 2.04}
          minPolarAngle={0.12}
        />
      </Canvas>
      <CropMarks />
      {badge ? (
        <div className="pointer-events-none absolute top-3 right-4 font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
          {badge}
        </div>
      ) : null}
      {parts.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
          {error ?? "RENDERING"}
        </div>
      ) : null}
    </div>
  );
}
