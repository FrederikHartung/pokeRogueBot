import { build } from "esbuild";
import { readdirSync } from "fs";
import { join } from "path";

const tsDir = "src/main/ts";
const outDir = "src/main/js";

// All .ts files except enums.ts (which is only imported, not an entry point)
const entryPoints = readdirSync(tsDir)
    .filter(f => f.endsWith(".ts") && f !== "enums.ts" && f !== "tsconfig.json")
    .map(f => join(tsDir, f));

console.log("Building JS bridge files...");
console.log("Entry points:", entryPoints.map(e => e.replace(tsDir + "/", "")));

await build({
    entryPoints,
    outdir: outDir,
    format: "iife",
    bundle: true,
    treeShaking: true,
    platform: "browser",
    target: "es2023",
    outExtension: { ".js": ".js" },
    // No sourcemaps needed for injected browser scripts
    sourcemap: false,
    // Don't minify - keep readable for debugging in browser console
    minify: false,
});

console.log(`Done! Built ${entryPoints.length} files to ${outDir}/`);
