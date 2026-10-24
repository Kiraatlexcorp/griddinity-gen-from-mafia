"use client";

import { MafiaLogo } from "@/components/studio/mafia-logo";
import { useEffect, useState } from "react";
import { Box, Download, Grid3x3, Link2, Moon, PanelTop, Sun } from "lucide-react";
import type * as React from "react";
import { PITCH_MM } from "@/lib/spec";
import { BinControls, LidControls, PlateControls } from "@/components/studio/controls";
import { lidHeight } from "@/lib/geometry/build";
import { PresetsCard } from "@/components/studio/presets-card";
import type { PickedPreset } from "@/lib/presets";
import { Preview } from "@/components/studio/preview";
import { useGeometry } from "@/components/studio/use-geometry";
import type { GeometryJob } from "@/lib/geometry/protocol";
import { QualityToggle, usePreviewQuality } from "@/components/studio/quality-toggle";
import { geometryQuality } from "@/lib/preview-quality";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { download3mf, downloadStls } from "@/lib/export/download";
import { binFootprint, binHeight, planBaseplate } from "@/lib/fit";
import {
  decodeState,
  encodeState,
  formatMm,
  type StudioState,
} from "@/lib/params";
import { useSearchParams } from "next/navigation";

function Wordmark() {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <MafiaLogo className="size-9 shrink-0 -my-1 drop-shadow-[0_1px_0_rgb(0_0_0/0.35)]" />
      <span className="flex min-w-0 items-baseline gap-1 font-heading leading-none">
        <span className="truncate whitespace-nowrap text-[15px] font-semibold tracking-tight">
          Gridfinity Studio
        </span>
      </span>
    </div>
  );
}

type Stat = { label: string; value: string; badge: string; note: string; hint: string };

/**
 * Below lg the stats are their own wrapping row under the header; from lg up
 * they sit inline in the header and the row is hidden. No dot separators.
 */
function StatBar({ stats, inline = false }: { stats: Stat[]; inline?: boolean }) {
  return (
    <div
      className={
        inline
          ? "hidden min-w-0 flex-1 items-center gap-x-4 overflow-hidden text-xs lg:flex"
          : "flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-card px-3 py-1.5 text-xs lg:hidden"
      }
    >
      {stats.map((stat) => (
        <span key={stat.label} title={`${stat.label} · ${stat.hint}`} className="whitespace-nowrap">
          <span className="font-heading font-semibold tabular-nums">{stat.value}</span>
          <span className={inline ? "hidden text-muted-foreground xl:inline" : "text-muted-foreground"}>
            {" "}
            {stat.note.toLowerCase()}
          </span>
        </span>
      ))}
    </div>
  );
}

export function Studio() {
  const search = useSearchParams();
  const [state, setState] = useState<StudioState>(() => decodeState(search.toString()));
  const [picked, setPicked] = useState<PickedPreset | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<null | "stl" | "3mf">(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const [previewQuality, setPreviewQuality] = usePreviewQuality();
  const job: GeometryJob =
    state.tab === "bin"
      ? { kind: "bin", params: state.bin }
      : state.tab === "lid"
        ? { kind: "lid", gridX: state.bin.gridX, gridY: state.bin.gridY, params: state.lid }
        : { kind: "baseplate", params: state.plate };
  const { parts, status, ms, error, exportMesh } = useGeometry(
    job,
    geometryQuality(previewQuality),
  );
  const plan = planBaseplate(state.plate);
  const foot = binFootprint(state.bin.gridX, state.bin.gridY);
  const height = binHeight(state.bin.gridZ, state.bin.lip);

  useEffect(() => {
    const next = `?${encodeState(state)}`;
    if (window.location.search !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [state]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("acme-theme", next ? "dark" : "light");
  }

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?${encodeState(state)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const stem =
    state.tab === "bin"
      ? `acmee-bin-${state.bin.gridX}x${state.bin.gridY}x${state.bin.gridZ}`
      : state.tab === "lid"
        ? `acmee-lid-${state.bin.gridX}x${state.bin.gridY}`
        : "error" in plan
        ? "acmee-baseplate"
        : `acmee-baseplate-${plan.gridX}x${plan.gridY}`;

  async function save(kind: "stl" | "3mf") {
    setExporting(kind);
    setExportError(null);
    try {
      const meshes = await exportMesh();
      if (kind === "stl") downloadStls(meshes, stem);
      else download3mf(meshes, state.plate.bed, stem, stem);
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const canExport = !error && !exporting && parts.length > 0;

  const failed = "error" in plan;
  const oversize = foot.width > state.plate.bed || foot.depth > state.plate.bed;
  const lidW = state.bin.gridX * PITCH_MM;
  const lidD = state.bin.gridY * PITCH_MM;
  const lidOversize = lidW > state.plate.bed || lidD > state.plate.bed;
  const lidStats: Stat[] = [
    {
      label: "Outer size",
      value: `${formatMm(lidW)} × ${formatMm(lidD)} mm`,
      badge: "top grid",
      note: "Footprint",
      hint: "Full pitch on top; the plug matches the bin",
    },
    {
      label: "Grid units",
      value: `${state.bin.gridX} × ${state.bin.gridY}`,
      badge: `${PITCH_MM} mm pitch`,
      note: `${state.bin.gridX * state.bin.gridY} sockets`,
      hint: "Shared with the bin",
    },
    {
      label: "Height",
      value: `${formatMm(lidHeight())} mm`,
      badge: state.lid.notch ? "notch" : "no notch",
      note: state.lid.notch ? "With finger notch" : "Plain edge",
      hint: "Plug, plate and sockets",
    },
    {
      label: "Bed fit",
      value: lidOversize ? "Too wide" : "Fits",
      badge: `${formatMm(state.plate.bed)} mm bed`,
      note: lidOversize ? "Overhangs the bed" : "on one bed",
      hint: "Prints plug side down",
    },
  ];
  const stats: Stat[] =
    state.tab === "lid"
      ? lidStats
      : state.tab === "baseplate"
      ? [
          {
            label: "Plate size",
            value: failed ? "—" : `${formatMm(plan.outerW)} × ${formatMm(plan.outerD)} mm`,
            badge: state.plate.unit === "grid" ? "grid" : "mm",
            note: "Outer footprint",
            hint: state.plate.pad ? "Padded to the drawer" : "Exact grid, no padding",
          },
          {
            label: "Grid units",
            value: failed ? "—" : `${plan.gridX} × ${plan.gridY}`,
            badge: `${PITCH_MM} mm pitch`,
            note: failed ? "No grid fits" : `${plan.gridX * plan.gridY} cells`,
            hint: "Standard Gridfinity spacing",
          },
          {
            label: "Thickness",
            value: failed ? "—" : `${formatMm(plan.thickness)} mm`,
            badge: state.plate.floor ? "floor" : "frame",
            note: state.plate.floor ? "Solid floor" : "Frame only, cells open",
            hint:
              state.plate.connectors === "none"
                ? "No connectors"
                : `${state.plate.connectors === "puzzle" ? "Puzzle" : "Clip"} connectors`,
          },
          {
            label: "Pieces",
            value: failed ? "—" : String(plan.pieces.length),
            badge: `${formatMm(state.plate.bed)} mm bed`,
            note: failed ? "too big" : plan.pieces.length === 1 ? "piece, prints in one go" : "pieces, cut on grid lines",
            hint: "Each piece fits the bed",
          },
        ]
      : [
          {
            label: "Outer size",
            value: `${formatMm(foot.width)} × ${formatMm(foot.depth)} mm`,
            badge: "−0.5 mm",
            note: "Footprint",
            hint: "Cells × 42 mm, minus clearance",
          },
          {
            label: "Grid units",
            value: `${state.bin.gridX} × ${state.bin.gridY} × ${state.bin.gridZ}`,
            badge: "7 mm units",
            note: `${state.bin.gridX * state.bin.gridY} cells`,
            hint: `${state.bin.elements.length} elements inside`,
          },
          {
            label: "Height",
            value: `${formatMm(height)} mm`,
            badge: `lip ${state.bin.lip}`,
            note: state.bin.lip === "none" ? "Flat top" : "Stacking lip adds 4.4 mm",
            hint: `Outer wall ${formatMm(state.bin.wall)} mm`,
          },
          {
            label: "Bed fit",
            value: oversize ? "Too wide" : "Fits",
            badge: `${formatMm(state.plate.bed)} mm bed`,
            note: oversize ? "Overhangs the bed" : "on one bed",
            hint: `Magnets ${state.bin.magnets}, screws ${state.bin.screws}`,
          },
        ];

  const exportIcon = (kind: "stl" | "3mf") =>
    exporting === kind ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />;

  return (
    <SidebarProvider
      className="h-svh min-h-0 overflow-hidden"
      style={{ "--sidebar-width": "22.5rem", "--header-height": "3rem" } as React.CSSProperties}
    >
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader className="gap-3">
          <div className="px-2 pt-1.5 pb-0.5">
            <Wordmark />
          </div>
          <Tabs
            value={state.tab}
            onValueChange={(value) => {
              if (value === "bin" || value === "baseplate" || value === "lid") {
                setState((current) => ({ ...current, tab: value }));
              }
            }}
          >
            <TabsList className="w-full">
              <TabsTrigger value="baseplate">
                <Grid3x3 data-icon="inline-start" />
                Baseplate
              </TabsTrigger>
              <TabsTrigger value="bin">
                <Box data-icon="inline-start" />
                Bin
              </TabsTrigger>
              <TabsTrigger value="lid">
                <PanelTop data-icon="inline-start" />
                Lid
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SidebarHeader>
        <SidebarContent className="px-2 pt-1 pb-4">
          <div className="flex shrink-0 flex-col gap-3">
            <PresetsCard
              state={state}
              picked={picked}
              onLoad={(next, pick) => {
                setState(next);
                setPicked(pick);
              }}
            />
            {state.tab === "baseplate" ? (
              <PlateControls
                plate={state.plate}
                onChange={(plate) => setState((current) => ({ ...current, plate }))}
              />
            ) : state.tab === "lid" ? (
              <LidControls
                bin={state.bin}
                lid={state.lid}
                onBinChange={(bin) => setState((current) => ({ ...current, bin }))}
                onChange={(lid) => setState((current) => ({ ...current, lid }))}
              />
            ) : (
              <BinControls
                bin={state.bin}
                bed={state.plate.bed}
                onChange={(bin) => setState((current) => ({ ...current, bin }))}
              />
            )}
          </div>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-h-0 overflow-y-auto md:overflow-hidden md:ring-1 md:ring-border">
        <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:rounded-t-xl lg:px-5">
          <h1 className="sr-only">Gridfinity Studio by ACMEE</h1>
          <SidebarTrigger className="-ml-1" />
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <span className="font-heading text-base font-semibold">
            {state.tab === "bin" ? "Bin" : state.tab === "lid" ? "Lid" : "Baseplate"}
          </span>
          <span aria-hidden className="mx-2 hidden h-4 w-px bg-border lg:block" />
          <StatBar stats={stats} inline />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => void copyLink()}>
              <Link2 data-icon="inline-start" />
              <span className="hidden sm:inline lg:hidden xl:inline">{copied ? "Copied" : "Copy link"}</span>
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Switch theme" onClick={toggleTheme}>
              <Sun className="hidden dark:block" />
              <Moon className="dark:hidden" />
            </Button>
            <Button type="button" size="sm" disabled={!canExport} onClick={() => void save("stl")}>
              {exportIcon("stl")}
              STL
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!canExport} onClick={() => void save("3mf")}>
              {exportIcon("3mf")}
              3MF
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-3 md:min-h-0 lg:p-5">
          <StatBar stats={stats} />
          {exportError ? (
            <Alert variant="destructive">
              <AlertTitle>Export failed</AlertTitle>
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          ) : null}
          <Card className="relative min-h-[60svh] flex-1 gap-0 p-0 md:min-h-0">
            <Preview
              parts={parts}
              status={status}
              ms={ms}
              error={error}
              quality={previewQuality}
              toolbar={<QualityToggle value={previewQuality} onChange={setPreviewQuality} />}
            />
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
