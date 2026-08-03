import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, "client"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const clientFingerprintSources = await Promise.all([
  resolve(root, "assets", "css", "app.css"),
  ...["data.js", "live.js", "match-center.js", "ui.js"].map((file) => resolve(root, "assets", "js", file)),
].map((file) => readFile(file, "utf8")));
const buildVersion = createHash("sha256").update([sourceHtml, ...clientFingerprintSources].join("\n")).digest("hex").slice(0, 10);
const productionHtml = sourceHtml
  .replace(/\s*<!-- PRODUCTION_STRIP_LEGACY_HTML_START -->[\s\S]*?<!-- PRODUCTION_STRIP_LEGACY_HTML_END -->\s*/g, "\n");
const versionedProductionHtml = productionHtml.replace(/\b(href|src)="(assets\/[^"?]+)(?:\?[^"#]*)?"/g, `$1="$2?v=${buildVersion}"`);

if (productionHtml.includes("PRODUCTION_STRIP_LEGACY")) {
  throw new Error("Production HTML temizleme işaretleri eşleşmedi.");
}
await writeFile(resolve(dist, "client", "index.html"), versionedProductionHtml);
await cp(resolve(root, "assets"), resolve(dist, "client", "assets"), { recursive: true });
await cp(resolve(root, "legal"), resolve(dist, "client", "legal"), { recursive: true });

for (const file of ["data.js", "live.js", "match-center.js", "ui.js"]) {
  const sourcePath = resolve(root, "assets", "js", file);
  const targetPath = resolve(dist, "client", "assets", "js", file);
  const source = await readFile(sourcePath, "utf8");
  const productionSource = source.replace(
    /\s*\/\* PRODUCTION_STRIP_LEGACY_JS_START \*\/[\s\S]*?\/\* PRODUCTION_STRIP_LEGACY_JS_END \*\/\s*/g,
    "\n",
  );
  if (productionSource.includes("PRODUCTION_STRIP_LEGACY")) {
    throw new Error(`${file} production temizleme işaretleri eşleşmedi.`);
  }
  await writeFile(targetPath, productionSource);
}

await cp(resolve(root, "worker", "index.js"), resolve(dist, "server", "index.js"));
await cp(resolve(root, ".openai", "hosting.json"), resolve(dist, ".openai", "hosting.json"));

console.log("XYZSKOR production build hazır: dist/");
