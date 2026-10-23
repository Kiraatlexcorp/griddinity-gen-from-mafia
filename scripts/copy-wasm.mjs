import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const source = join("node_modules", "manifold-3d", "manifold.wasm");
const destination = join("public", "manifold.wasm");
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(source, destination);
