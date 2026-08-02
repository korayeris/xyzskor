import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, "client"), { recursive: true });

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const productionHtml = sourceHtml
  .replace(/\s*<!-- PRODUCTION_STRIP_LEGACY_HTML_START -->[\s\S]*?<!-- PRODUCTION_STRIP_LEGACY_HTML_END -->\s*/g, "\n")
  .replace(/\s*\/\* PRODUCTION_STRIP_LEGACY_JS_START \*\/[\s\S]*?\/\* PRODUCTION_STRIP_LEGACY_JS_END \*\/\s*/g, "\n");

if (productionHtml.includes("PRODUCTION_STRIP_LEGACY")) {
  throw new Error("Production temizleme işaretleri eşleşmedi.");
}
await writeFile(resolve(dist, "client", "index.html"), productionHtml);
await cp(resolve(root, "assets"), resolve(dist, "client", "assets"), { recursive: true });
await cp(resolve(root, "worker", "index.js"), resolve(dist, "server", "index.js"));

console.log("XYZSKOR production build hazır: dist/");
