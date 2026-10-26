"use client";

import {
  Environment,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Lightformer,
  OrbitControls,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ArrowDownToLine, Grid2x2, Square } from "lucide-react";
import * as THREE from "three";
import type * as React from "react";
import type { MeshPart } from "@/lib/geometry/protocol";
import { previewGeometry } from "@/lib/geometry/preview-mesh";
import type { PreviewQuality } from "@/lib/preview-quality";

const FILAMENT = [
  "#d4d4d4",
  "#c8c8c8",
  "#dcdcdc",
  "#bdbdbd",
  "#d0d0d0",
  "#c4c4c4",
];
const FILAMENT_DARK = [
  "#b8b8b8",
  "#a8a8a8",
  "#c4c4c4",
  "#9c9c9c",
  "#b0b0b0",
  "#a2a2a2",
];

type Orbit = {
  target: THREE.Vector3;
  update: () => void;
  minDistance: number;
  maxDistance: number;
};

function PartMesh({
  part,
  color,
  quality,
  onPick,
}: {
  part: MeshPart;
  color: string;
  quality: PreviewQuality;
  onPick?: (part: MeshPart) => void;
}) {
  const geometry = useMemo(
    () => previewGeometry(part, quality),
    [part, quality],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      onClick={
        onPick
          ? (event) => {
              // Ignore the click that ends an orbit drag.
              if (event.delta > 4) return;
              event.stopPropagation();
              onPick(part);
            }
          : undefined
      }
      onPointerOver={onPick ? () => (document.body.style.cursor = "pointer") : undefined}
      onPointerOut={onPick ? () => (document.body.style.cursor = "") : undefined}
    >
      {quality === "high" ? (
        <meshPhysicalMaterial
          color={color}
          roughness={0.58}
          metalness={0.02}
          clearcoat={0.12}
          clearcoatRoughness={0.6}
          envMapIntensity={0.55}
          side={THREE.DoubleSide}
        />
      ) : (
        <meshStandardMaterial
          color={color}
          roughness={0.72}
          metalness={0.04}
          flatShading
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

function frameCamera(
  camera: THREE.PerspectiveCamera,
  controls: Orbit | null,
  parts: MeshPart[],
  direction: THREE.Vector3 = new THREE.Vector3(0.82, 0.62, 0.95),
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
    .add(direction.clone().normalize().multiplyScalar(distance));
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

type ViewName = "perspective" | "top" | "front" | "right";
const VIEW_DIRECTIONS: Record<ViewName, [number, number, number]> = {
  perspective: [0.82, 0.62, 0.95],
  top: [0, 1, 0.001],
  front: [0, 0, 1],
  right: [1, 0, 0],
};

function Fit({
  parts,
  view = "perspective",
  home = 0,
}: {
  parts: MeshPart[];
  view?: ViewName;
  home?: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as Orbit | null;

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    frameCamera(
      camera,
      controls,
      parts,
      new THREE.Vector3(...VIEW_DIRECTIONS[view]),
    );
  }, [camera, controls, parts, view, home]);

  return null;
}

/** Ground grid that hides while the camera is below it, so the underside stays visible. */
function GroundGrid(props: React.ComponentProps<typeof Grid>) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = camera.position.y > 0;
  });
  return <Grid ref={ref} {...props} />;
}

/** Each bump of `tick` swings the camera straight under the model. */
function BottomView({ tick }: { tick: number }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as Orbit | null;
  useEffect(() => {
    if (!tick || !controls) return;
    const distance = camera.position.distanceTo(controls.target);
    camera.position.set(
      controls.target.x,
      controls.target.y - distance,
      controls.target.z + 0.01,
    );
    camera.lookAt(controls.target);
    controls.update();
  }, [tick, camera, controls]);
  return null;
}

/**
 * Maya-style view gizmo: click an axis head (±X right/left, ±Y top/bottom, ±Z front/back)
 * to snap there; click the centre cube to go back to the home view.
 */
function ViewGizmo({ onHome }: { onHome: () => void }) {
  return (
    <GizmoHelper alignment="top-left" margin={[64, 64]}>
      <GizmoViewport
        axisColors={["#e5484d", "#46a758", "#3e63dd"]}
        labels={["R", "T", "F"]}
        labelColor="#ffffff"
      />
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onHome();
        }}
      >
        <boxGeometry args={[14, 14, 14]} />
        <meshBasicMaterial color="#9ca3af" toneMapped={false} />
      </mesh>
    </GizmoHelper>
  );
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
  quality,
  toolbar,
  stats,
  paint,
  overlay,
}: {
  /** Paint mode: colour parts by their AMS slot and pick them on click. */
  paint?: { palette: string[]; colorOf: (part: MeshPart) => string | null; onPick: (part: MeshPart) => void };
  /** Floating panel along the top centre of the viewer. */
  overlay?: React.ReactNode;
  /** Overlay strip along the bottom right of the viewer. */
  stats?: React.ReactNode;
  parts: MeshPart[];
  quality: PreviewQuality;
  toolbar?: React.ReactNode;
  status: "rendering" | "ready" | "error";
  ms: number;
  error: string | null;
}) {
  const dark = useDarkPaper();
  const [bottomTick, setBottomTick] = useState(0);
  const [quad, setQuad] = useState(false);
  const [homeTick, setHomeTick] = useState(0);
  const colors = dark ? FILAMENT_DARK : FILAMENT;
  const badge =
    status === "rendering"
      ? "RENDERING"
      : status === "error"
        ? "FAILED"
        : ms > 0
          ? `${ms} ms`
          : "";

  const scene = (view: ViewName) => (
    <Canvas
      key={`${quality}-${view}`}
      className="h-full w-full"
      dpr={quality === "high" ? [1, 2] : [1, 1.25]}
      gl={{ alpha: true, antialias: quality === "high" }}
      camera={{ fov: 32, position: [180, 130, 190], near: 0.1, far: 5000 }}
    >
      <ambientLight intensity={0.72} />
      <directionalLight position={[80, 140, 60]} intensity={1.15} />
      <directionalLight position={[-70, 40, -40]} intensity={0.35} />
      {quality === "high" ? (
        <Environment resolution={64} frames={1}>
          <Lightformer
            form="rect"
            intensity={1.4}
            position={[0, 6, 0]}
            rotation-x={Math.PI / 2}
            scale={[12, 12, 1]}
          />
          <Lightformer
            form="rect"
            intensity={0.6}
            position={[-6, 2, 4]}
            rotation-y={Math.PI / 3}
            scale={[8, 4, 1]}
          />
          <Lightformer
            form="rect"
            intensity={0.4}
            position={[6, 1, -4]}
            rotation-y={-Math.PI / 2}
            scale={[8, 4, 1]}
          />
        </Environment>
      ) : null}
      <GroundGrid
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
        <PartMesh
          key={part.name}
          part={part}
          quality={quality}
          color={paint?.colorOf(part) ?? colors[index % colors.length]}
          onPick={paint?.onPick}
        />
      ))}
      <Fit parts={parts} view={view} home={homeTick} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.14}
        maxPolarAngle={Math.PI - 0.02}
        minPolarAngle={0.02}
      />
      {view === "perspective" ? <BottomView tick={bottomTick} /> : null}
      {view === "perspective" ? (
        <ViewGizmo onHome={() => setHomeTick((tick) => tick + 1)} />
      ) : null}
    </Canvas>
  );

  return (
    <div className="absolute inset-0 bg-background">
      {quad ? (
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-border">
          {(["top", "front", "right", "perspective"] as const).map((name) => (
            <div key={name} className="relative bg-background">
              {scene(name)}
              <span className="pointer-events-none absolute top-2 left-3 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
                {name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        scene("perspective")
      )}
      <CropMarks />
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        {toolbar}
        <button
          type="button"
          aria-label="View from bottom"
          title="View the underside"
          onClick={() => setBottomTick((tick) => tick + 1)}
          className="flex h-7 items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowDownToLine className="size-3.5" aria-hidden />
          Bottom
        </button>
        <button
          type="button"
          aria-pressed={quad}
          aria-label={quad ? "Single view" : "Quad view"}
          title={
            quad ? "Back to a single view" : "Top, front, side and 3D at once"
          }
          onClick={() => {
            setBottomTick(0);
            setQuad((value) => !value);
          }}
          className="hidden h-7 items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
        >
          {quad ? (
            <Square className="size-3.5" aria-hidden />
          ) : (
            <Grid2x2 className="size-3.5" aria-hidden />
          )}
          {quad ? "Single" : "Quad"}
        </button>
      </div>
      {overlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">{overlay}</div>
      ) : null}
      {stats ? (
        <div className="pointer-events-none absolute right-4 bottom-4 max-w-[min(60%,32rem)]">
          {stats}
        </div>
      ) : null}
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
