"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { SectionCard } from "@/components/studio/section-card";
import { ElementsPanel } from "@/components/studio/elements-panel";
import {
  MeasureField,
  SelectField,
  SwitchField,
} from "@/components/studio/fields";
import { Input } from "@/components/ui/input";
import { cleanLabelText, LABEL_TEXT_MAX } from "@/lib/geometry/pixel-font";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  binCavityHeight,
  binFootprint,
  binHeight,
  fitDividers,
  labelTabFits,
  planBaseplate,
} from "@/lib/fit";
import {
  formatMm,
  type BaseplateParams,
  type BinParams,
  type LabelPosition,
  type LidParams,
} from "@/lib/params";
import { lidHeight } from "@/lib/geometry/build";
import {
  BED_PRESETS,
  PITCH_MM,
  PLATE_EDGES,
  SOCKET_DEPTH_MM,
  BIN_LIMITS,
  type HolePattern,
  type BedPreset,
  type ConnectorKind,
  type PlateEdge,
} from "@/lib/spec";

function Choice<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ToggleGroup
        size="sm"
        spacing={0}
        value={[value]}
        onValueChange={(next) => {
          const picked = next[next.length - 1];
          if (picked) onChange(picked as T);
        }}
        data-slot="tune-segments"
        className="tune-segments w-full"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="tune-segment flex-1 px-1.5"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

const EDGE_LABELS: Record<PlateEdge, string> = {
  left: "Left",
  right: "Right",
  bottom: "Front",
  top: "Back",
};

export function PlateControls({
  plate,
  onChange,
}: {
  plate: BaseplateParams;
  onChange: (plate: BaseplateParams) => void;
}) {
  const plan = planBaseplate(plate);
  const failed = "error" in plan;
  const mm = plate.unit === "mm";

  function patch(partial: Partial<BaseplateParams>) {
    onChange({ ...plate, ...partial });
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionCard id="plate" title="Plate">
        <p className="font-mono text-sm tabular-nums">
          {failed
            ? "No grid fits"
            : `${plan.gridX} × ${plan.gridY} · ${formatMm(plan.outerW)} × ${formatMm(plan.outerD)} × ${formatMm(plan.thickness)} mm`}
        </p>
        {failed ? null : (
          <FieldDescription>
            {plan.pieces.length === 1
              ? "One piece, centered on the bed."
              : `${plan.pieces.length} pieces, cut on grid lines so each fits the bed.`}
            {plate.pad && plate.unit === "mm"
              ? ` Margin ${formatMm(plan.marginLeft)} / ${formatMm(plan.marginRight)} mm by ${formatMm(plan.marginBottom)} / ${formatMm(plan.marginTop)} mm.`
              : ""}
          </FieldDescription>
        )}

        {failed ? (
          <Alert variant="destructive">
            <AlertTitle>Drawer is short of a cell</AlertTitle>
            <AlertDescription>{plan.error}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ctx-chip"
              onClick={() =>
                patch({ unit: "mm", width: 252, depth: 168, pad: false })
              }
            >
              6 × 4 grid
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ctx-chip"
              onClick={() =>
                patch({ unit: "mm", width: 500, depth: 380, pad: true })
              }
            >
              500 × 380 drawer
            </Button>
          </div>
          <Choice
            label="Measure in"
            value={plate.unit}
            options={[
              { value: "mm", label: "Millimetres" },
              { value: "grid", label: "Grid units" },
            ]}
            onChange={(unit) => {
              if (unit === plate.unit) return;
              if (unit === "grid") {
                const next = planBaseplate({ ...plate, pad: false });
                patch({
                  unit,
                  pad: false,
                  width: "error" in next ? 1 : next.gridX,
                  depth: "error" in next ? 1 : next.gridY,
                });
                return;
              }
              patch({
                unit,
                width: Math.round(plate.width) * PITCH_MM,
                depth: Math.round(plate.depth) * PITCH_MM,
              });
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <MeasureField
              label="Width"
              suffix={mm ? "MM" : "U"}
              value={plate.width}
              min={mm ? 42 : 1}
              max={mm ? 800 : 16}
              step={mm ? 1 : 1}
              digits={mm ? 0 : 0}
              onChange={(width) =>
                patch({ width: mm ? width : Math.round(width) })
              }
            />
            <MeasureField
              label="Depth"
              suffix={mm ? "MM" : "U"}
              value={plate.depth}
              min={mm ? 42 : 1}
              max={mm ? 800 : 16}
              step={1}
              digits={0}
              onChange={(depth) =>
                patch({ depth: mm ? depth : Math.round(depth) })
              }
            />
          </div>
          {mm ? (
            <Choice
              label="Leftover space"
              hint="Padding is a solid border in the millimetres a whole cell cannot fill. It is split across the cut pieces."
              value={plate.pad ? "pad" : "grid"}
              options={[
                { value: "grid", label: "Grid only" },
                { value: "pad", label: "Pad it" },
              ]}
              onChange={(value) => patch({ pad: value === "pad" })}
            />
          ) : (
            <Field>
              <FieldDescription>
                Grid units are an exact {PITCH_MM} mm pitch, so the plate has no
                leftover to pad.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>
      </SectionCard>

      <SectionCard id="bed" title="Bed">
        <FieldGroup className="gap-4">
          <Choice
            label="Printer"
            hint="A1 and P1S / X1C share a 256 mm square. A1 mini is 180 mm. Pieces are cut so each one fits."
            value={plate.bedPreset}
            options={BED_PRESETS.map((preset) => ({
              value: preset.id,
              label:
                preset.id === "mini"
                  ? "Mini"
                  : preset.id === "p1s"
                    ? "P1S"
                    : preset.id === "a1"
                      ? "A1"
                      : "Custom",
            }))}
            onChange={(bedPreset: BedPreset) => {
              const preset = BED_PRESETS.find((item) => item.id === bedPreset);
              if (!preset || bedPreset === "custom") {
                patch({ bedPreset: "custom" });
                return;
              }
              patch({ bedPreset, bed: preset.bed });
            }}
          />
          {plate.bedPreset === "custom" ? (
            <MeasureField
              label="Bed size"
              suffix="MM"
              hint="Square bed. A piece needs at least one 42 mm cell."
              value={plate.bed}
              min={42}
              max={400}
              step={1}
              digits={0}
              onChange={(bed) => patch({ bed })}
            />
          ) : null}
        </FieldGroup>
      </SectionCard>

      <SectionCard id="frame" title="Frame">
        <FieldGroup className="gap-4">
          <SwitchField
            id="plate-floor"
            label="Floor"
            hint={
              plate.floor
                ? "Solid slab under the sockets, for magnets, screws or weights."
                : `Open grid frame only: ${formatMm(SOCKET_DEPTH_MM)} mm tall, every cell open through. Lightest and fastest to print.`
            }
            checked={plate.floor}
            onChange={(floor) => patch({ floor })}
          />
          <SelectField<ConnectorKind>
            label="Connectors"
            hint={
              plate.connectors === "puzzle"
                ? "Dovetails with 0.2 mm clearance. Right and back edges get tabs, left and front get sockets, so plates chain in any direction."
                : plate.connectors === "clips"
                  ? "Bowtie notches on the picked edges. A separate clip part is added to the export, one per joint."
                  : "Plain edges. Pieces cut to fit the bed still join with puzzle tabs only when connectors are on."
            }
            value={plate.connectors}
            options={[
              { value: "none", label: "None" },
              { value: "clips", label: "Clips" },
              { value: "puzzle", label: "Puzzle edge" },
            ]}
            onChange={(connectors) => patch({ connectors })}
          />
          {plate.connectors !== "none" ? (
            <Field>
              <FieldLabel>Edges</FieldLabel>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                multiple
                value={plate.edges}
                onValueChange={(next) =>
                  patch({
                    edges: PLATE_EDGES.filter((edge) => next.includes(edge)),
                  })
                }
                className="w-full"
              >
                {PLATE_EDGES.map((edge) => (
                  <ToggleGroupItem
                    key={edge}
                    value={edge}
                    className="flex-1 px-1.5"
                  >
                    {EDGE_LABELS[edge]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <FieldDescription>
                Joints sit on the inner grid lines, where the frame is solid, so
                an edge one cell long has none. Seams between bed pieces always
                get them.
              </FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>
      </SectionCard>

      {plate.floor ? (
        <SectionCard id="fasteners" title="Fasteners">
          <FieldGroup className="gap-4">
            <Choice
              label="Plate style"
              hint="Weighted adds 6.4 mm under the plate, with a 21.4 mm pocket and finger slots."
              value={plate.style}
              options={[
                { value: "plain", label: "Plain" },
                { value: "weighted", label: "Weighted" },
              ]}
              onChange={(style) => patch({ style })}
            />
            <SwitchField
              id="plate-magnets"
              label="Magnet holes"
              hint="6 × 2 mm magnets. The hole is 6.5 mm wide and 2.4 mm deep."
              checked={plate.magnets}
              onChange={(magnets) => patch({ magnets })}
            />
            <SwitchField
              id="plate-screws"
              label="Screw holes"
              hint="M3, centered on the magnet positions, through the plate."
              checked={plate.screws}
              onChange={(screws) => patch({ screws })}
            />
          </FieldGroup>
        </SectionCard>
      ) : null}
    </div>
  );
}

const HOLES: { value: HolePattern; label: string }[] = [
  { value: "none", label: "None" },
  { value: "corner", label: "Corner" },
  { value: "full", label: "Full" },
];

const LABELS: { value: LabelPosition; label: string }[] = [
  { value: "none", label: "None" },
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "full", label: "Full" },
];

export function BinControls({
  bin,
  bed,
  onChange,
}: {
  bin: BinParams;
  bed: number;
  onChange: (bin: BinParams) => void;
}) {
  const foot = binFootprint(bin.gridX, bin.gridY);
  const height = binHeight(bin.gridZ, bin.lip);
  const cavity = binCavityHeight(bin.gridZ, bin.wall, bin.lite);
  const innerW = foot.width - bin.wall * 2;
  const innerD = foot.depth - bin.wall * 2;
  const notes: string[] = [];
  if (bin.label !== "none" && !labelTabFits(cavity.cavity)) {
    notes.push(
      "This height is too short for a label tab, so the tab is left off.",
    );
  }
  const oversize = foot.width > bed || foot.depth > bed;
  const dividersX = fitDividers(innerW, bin.dividerWall, bin.dividersX);
  const dividersY = fitDividers(innerD, bin.dividerWall, bin.dividersY);
  const capped = dividersX.count < bin.dividersX || dividersY.count < bin.dividersY;

  function patch(partial: Partial<BinParams>) {
    onChange({ ...bin, ...partial });
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionCard id="bin" title="Bin">
        <p className="font-mono text-sm tabular-nums">
          {formatMm(foot.width)} × {formatMm(foot.depth)} × {formatMm(height)}{" "}
          mm
        </p>
        <FieldDescription>
          {bin.gridX} × {bin.gridY} cells, {bin.gridZ} × 7 mm
          {bin.lip === "none"
            ? ", flat top"
            : ` plus a 4.4 mm ${bin.lip === "thin" ? "thin " : ""}lip`}
          . Outer size is cells × 42 mm, minus 0.5 mm.
        </FieldDescription>

        {oversize ? (
          <Alert>
            <AlertTitle>Wider than the bed</AlertTitle>
            <AlertDescription>
              This bin is {formatMm(foot.width)} × {formatMm(foot.depth)} mm.
              The bed is {formatMm(bed)} mm, so the slicer will hang it off the
              plate.
            </AlertDescription>
          </Alert>
        ) : null}

        {notes.length > 0 ? (
          <Alert>
            <AlertTitle>Adjusted to fit</AlertTitle>
            <AlertDescription>{notes.join(" ")}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup className="gap-4">
          <div className="grid grid-cols-2 gap-2">
            <MeasureField
              label="Width"
              suffix="CELLS"
              value={bin.gridX}
              min={1}
              max={12}
              step={1}
              digits={0}
              onChange={(gridX) => patch({ gridX: Math.round(gridX) })}
            />
            <MeasureField
              label="Depth"
              suffix="CELLS"
              value={bin.gridY}
              min={1}
              max={12}
              step={1}
              digits={0}
              onChange={(gridY) => patch({ gridY: Math.round(gridY) })}
            />
            <MeasureField
              label="Height"
              suffix="× 7 MM"
              hint="Stacking lip, when on, adds 4.4 mm above this."
              value={bin.gridZ}
              min={1}
              max={12}
              step={1}
              digits={0}
              onChange={(gridZ) => patch({ gridZ: Math.round(gridZ) })}
            />
          </div>
        </FieldGroup>
      </SectionCard>

      <SectionCard id="walls" title="Walls">
        <FieldGroup className="gap-4">
          <div className="grid grid-cols-2 gap-2">
            <MeasureField
              label="Outer wall"
              suffix="MM"
              hint="1.2 mm prints cleanly on a 0.4 mm nozzle. The floor uses the same thickness in lite mode."
              value={bin.wall}
              min={BIN_LIMITS.wall.min}
              max={BIN_LIMITS.wall.max}
              step={BIN_LIMITS.wall.step}
              digits={1}
              onChange={(wall) => patch({ wall: Math.round(wall * 10) / 10 })}
            />
            <MeasureField
              label="Inner wall"
              suffix="MM"
              hint="Thickness of every Wall element."
              value={bin.innerWall}
              min={BIN_LIMITS.innerWall.min}
              max={BIN_LIMITS.innerWall.max}
              step={BIN_LIMITS.innerWall.step}
              digits={1}
              onChange={(innerWall) =>
                patch({ innerWall: Math.round(innerWall * 10) / 10 })
              }
            />
          </div>
        </FieldGroup>
      </SectionCard>
      <SectionCard id="dividers" title="Dividers">
        <FieldGroup className="gap-4">
          <div className="grid grid-cols-2 gap-2">
            <MeasureField
              label="Across the width"
              suffix="WALLS"
              hint={`${dividersX.count + 1} column${dividersX.count ? "s" : ""}, ${formatMm(dividersX.opening)} mm each.`}
              value={bin.dividersX}
              min={BIN_LIMITS.dividers.min}
              max={BIN_LIMITS.dividers.max}
              step={1}
              digits={0}
              onChange={(value) => patch({ dividersX: Math.round(value) })}
            />
            <MeasureField
              label="Across the depth"
              suffix="WALLS"
              hint={`${dividersY.count + 1} row${dividersY.count ? "s" : ""}, ${formatMm(dividersY.opening)} mm each.`}
              value={bin.dividersY}
              min={BIN_LIMITS.dividers.min}
              max={BIN_LIMITS.dividers.max}
              step={1}
              digits={0}
              onChange={(value) => patch({ dividersY: Math.round(value) })}
            />
          </div>
          {bin.dividersX + bin.dividersY > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <MeasureField
                  label="Divider thickness"
                  suffix="MM"
                  value={bin.dividerWall}
                  min={BIN_LIMITS.dividerWall.min}
                  max={BIN_LIMITS.dividerWall.max}
                  step={BIN_LIMITS.dividerWall.step}
                  digits={1}
                  onChange={(value) => patch({ dividerWall: Math.round(value * 10) / 10 })}
                />
                <MeasureField
                  label="Divider height"
                  suffix="%"
                  hint={`${formatMm((cavity.cavity * bin.dividerHeight) / 100)} mm above the floor. 100% reaches the rim.`}
                  value={bin.dividerHeight}
                  min={BIN_LIMITS.dividerHeight.min}
                  max={BIN_LIMITS.dividerHeight.max}
                  step={BIN_LIMITS.dividerHeight.step}
                  digits={0}
                  onChange={(value) => patch({ dividerHeight: Math.round(value / 5) * 5 })}
                />
              </div>
            </>
          ) : null}
          {capped ? (
            <FieldDescription>Some dividers are left out so every compartment stays at least 8 mm wide.</FieldDescription>
          ) : null}
        </FieldGroup>
      </SectionCard>

      <div className="contents">
        <ElementsPanel
          elements={bin.elements}
          inner={{ w: innerW, d: innerD }}
          cavity={cavity.cavity}
          innerWall={bin.innerWall}
          scoop={bin.scoop}
          onScoopChange={(scoop) =>
            patch({ scoop: Math.round(scoop * 100) / 100 })
          }
          onChange={(elements) => patch({ elements })}
        />
      </div>

      <SectionCard id="features" title="Features">
        <FieldGroup className="gap-4">
          <Choice
            label="Label tab"
            hint="Sits on the back inner wall."
            value={bin.label}
            options={LABELS}
            onChange={(label) => patch({ label })}
          />
          {bin.label !== "none" ? (
            <Field>
              <FieldLabel htmlFor="label-text">Raised text</FieldLabel>
              <Input
                id="label-text"
                value={bin.labelText}
                maxLength={LABEL_TEXT_MAX}
                placeholder="e.g. M3 SCREWS"
                autoComplete="off"
                className="font-heading uppercase"
                onChange={(event) => patch({ labelText: cleanLabelText(event.target.value) })}
              />
              <FieldDescription>
                Up to {LABEL_TEXT_MAX} letters, digits or - . # + /, raised 0.6 mm on the tab. Leave empty for a plain tab.
              </FieldDescription>
            </Field>
          ) : null}
          <Choice
            label="Lip style"
            hint={
              bin.lip === "default"
                ? "Standard 4.4 mm stacking lip."
                : bin.lip === "thin"
                  ? "Same outside and height, about half the wall. Still stacks, saves filament."
                  : "Flat top, 4.4 mm lower. Bins will not lock when stacked."
            }
            value={bin.lip}
            options={[
              { value: "default", label: "Default" },
              { value: "thin", label: "Thin" },
              { value: "none", label: "None" },
            ]}
            onChange={(lip) => patch({ lip })}
          />
          <Choice
            label="Floor"
            hint="Lite hollows the base and drops the compartment floor onto the 4.75 mm profile."
            value={bin.lite ? "lite" : "full"}
            options={[
              { value: "full", label: "Full base" },
              { value: "lite", label: "Lite" },
            ]}
            onChange={(value) => patch({ lite: value === "lite" })}
          />
          <Choice
            label="Base magnets"
            hint="6.5 × 2.4 mm pockets, 8 mm in from the cell edge. Corner puts one at each outer corner of the bin, Full puts 4 under every cell."
            value={bin.magnets}
            options={HOLES}
            onChange={(magnets) => patch({ magnets })}
          />
          <Choice
            label="Screw holes"
            hint="3 mm holes through the base, at the same positions."
            value={bin.screws}
            options={HOLES}
            onChange={(screws) => patch({ screws })}
          />
        </FieldGroup>
      </SectionCard>
    </div>
  );
}

export function LidControls({
  bin,
  lid,
  onBinChange,
  onChange,
}: {
  bin: BinParams;
  lid: LidParams;
  onBinChange: (bin: BinParams) => void;
  onChange: (lid: LidParams) => void;
}) {
  const foot = binFootprint(bin.gridX, bin.gridY);
  return (
    <div className="flex flex-col gap-3">
      <SectionCard id="lid" title="Lid">
        <p className="font-mono text-sm tabular-nums">
          {formatMm(bin.gridX * PITCH_MM)} × {formatMm(bin.gridY * PITCH_MM)} × {formatMm(lidHeight())} mm
        </p>
        <FieldDescription>
          Sits in the bin&apos;s stacking lip ({formatMm(foot.width)} × {formatMm(foot.depth)} mm bin). The top is a
          baseplate grid, so another bin stacks on it. Width and depth are shared with the bin.
        </FieldDescription>
        {bin.lip === "none" ? (
          <Alert>
            <AlertTitle>Bin has no stacking lip</AlertTitle>
            <AlertDescription>The lid seats in the lip. Turn the bin&apos;s lip on so it stays put.</AlertDescription>
          </Alert>
        ) : null}
        <FieldGroup className="gap-4">
          <div className="grid grid-cols-2 gap-2">
            <MeasureField
              label="Width"
              suffix="CELLS"
              value={bin.gridX}
              min={1}
              max={12}
              step={1}
              digits={0}
              onChange={(gridX) => onBinChange({ ...bin, gridX: Math.round(gridX) })}
            />
            <MeasureField
              label="Depth"
              suffix="CELLS"
              value={bin.gridY}
              min={1}
              max={12}
              step={1}
              digits={0}
              onChange={(gridY) => onBinChange({ ...bin, gridY: Math.round(gridY) })}
            />
          </div>
          <SwitchField
            id="lid-notch"
            label="Finger notch"
            hint="A scallop in the front edge to lift the lid off."
            checked={lid.notch}
            onChange={(notch) => onChange({ ...lid, notch })}
          />
        </FieldGroup>
      </SectionCard>
    </div>
  );
}
