import { mkdirSync, writeFileSync } from "node:fs";
import { meshToStl } from "../lib/export/stl";
import { meshTo3mf } from "../lib/export/threemf";
import { buildBaseplate, buildBin } from "../lib/geometry/build";
import { loadManifold } from "../lib/geometry/manifold";
import { DEFAULT_BIN, type BaseplateParams } from "../lib/params";

const out = "/opt/cursor/artifacts";
mkdirSync(out, { recursive: true });

async function main() {
  const wasm = await loadManifold();

function time<T>(run: () => T) {
  const started = performance.now();
  const result = run();
  return { result, ms: Math.round((performance.now() - started) * 10) / 10 };
}

const plate: BaseplateParams = {
  unit: "grid",
  width: 6,
  depth: 5,
  pad: false,
  bedPreset: "a1",
  bed: 256,
  magnets: true,
  screws: true,
  style: "plain",
      floor: true,
      connectors: "none" as const,
      edges: [],
};

const split: BaseplateParams = {
  unit: "mm",
  width: 300,
  depth: 84,
  pad: false,
  bedPreset: "a1",
  bed: 256,
  magnets: true,
  screws: false,
  style: "plain",
      floor: true,
      connectors: "none" as const,
      edges: [],
};

const binPreview = time(() => buildBin(wasm, DEFAULT_BIN, "preview"));
const binExport = time(() => buildBin(wasm, DEFAULT_BIN, "export"));
const platePreview = time(() => buildBaseplate(wasm, plate, "preview"));
const plateExport = time(() => buildBaseplate(wasm, plate, "export"));
const splitExport = time(() => buildBaseplate(wasm, split, "export"));

function triangles(parts: { indices: Uint32Array }[]) {
  return parts.reduce((sum, part) => sum + part.indices.length / 3, 0);
}

writeFileSync(`${out}/pitch-bin-3x2x6.stl`, meshToStl(binExport.result[0]));
writeFileSync(`${out}/pitch-bin-3x2x6.3mf`, meshTo3mf(binExport.result, 256, "pitch-bin-3x2x6"));
writeFileSync(`${out}/pitch-baseplate-6x5.stl`, meshToStl(plateExport.result[0]));
writeFileSync(
  `${out}/pitch-baseplate-6x5.3mf`,
  meshTo3mf(plateExport.result, 256, "pitch-baseplate-6x5"),
);
writeFileSync(
  `${out}/pitch-baseplate-split.3mf`,
  meshTo3mf(splitExport.result, 256, "pitch-baseplate-split"),
);

const report = {
  bin_3x2x6_preview_ms: binPreview.ms,
  bin_3x2x6_export_ms: binExport.ms,
  bin_3x2x6_triangles_export: triangles(binExport.result),
  baseplate_6x5_preview_ms: platePreview.ms,
  baseplate_6x5_export_ms: plateExport.ms,
  baseplate_6x5_triangles_export: triangles(plateExport.result),
  baseplate_6x5_pieces: plateExport.result.length,
  split_pieces: splitExport.result.length,
  split_export_ms: splitExport.ms,
};

  writeFileSync(`${out}/bench.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

void main();
