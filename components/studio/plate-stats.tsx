import { CircleCheck, TriangleAlert } from "lucide-react";
import type { BaseplateParams } from "@/lib/params";
import { formatMm } from "@/lib/params";
import type { planBaseplate } from "@/lib/fit";

/** Baseplate size and bed fit, shown as a strip over the bottom of the viewer. */
export function PlateStats({ plate, plan }: { plate: BaseplateParams; plan: ReturnType<typeof planBaseplate> }) {
  if ("error" in plan) return null;
  const onePiece = plan.pieces.length === 1;
  const margin =
    plate.pad && plate.unit === "mm"
      ? ` Margin ${formatMm(plan.marginLeft)} / ${formatMm(plan.marginRight)} by ${formatMm(plan.marginBottom)} / ${formatMm(plan.marginTop)} mm.`
      : "";
  return (
    <div
      data-testid="plate-stats"
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 rounded-xl border border-border bg-background/85 px-3 py-1.5 text-xs backdrop-blur"
    >
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {[
          ["Grid", `${plan.gridX} × ${plan.gridY}`],
          ["Size", `${formatMm(plan.outerW)} × ${formatMm(plan.outerD)} mm`],
          ["Height", `${formatMm(plan.thickness)} mm`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono whitespace-nowrap tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p
        data-testid="plate-fit"
        title={margin.trim() || undefined}
        className={`flex items-center gap-1 ${onePiece ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
      >
        {onePiece ? <CircleCheck aria-hidden className="size-3.5" /> : <TriangleAlert aria-hidden className="size-3.5" />}
        {onePiece ? "Fits bed in one piece" : `Needs splitting: ${plan.pieces.length} pieces`}
      </p>
    </div>
  );
}
