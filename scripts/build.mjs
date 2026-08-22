import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await mkdir(resolve(dist, "client"), { recursive: true });
await mkdir(resolve(dist, ".openai"), { recursive: true });

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
// Tek kaynak liste: hem parmak izi (cache busting) hem de minify bu listeyi kullanır.
// chat.js daha önce parmak izine DAHİL DEĞİLDİ; bu yüzden yalnızca chat.js
// değiştiğinde buildVersion aynı kalıyor ve tarayıcı eski dosyayı önbellekten
// sunabiliyordu. Liste tek yere alınarak bu sınıf hata tekrarlanamaz hale getirildi.
const CLIENT_JS_FILES = ["initial-route.js", "data.js", "analytics.js", "live.js", "match-center.js", "matchday-live.js", "predict-game.js", "ui.js", "chat.js", "multisport.js", "sport-branches.js", "motorsports.js", "ufc-hub.js", "compliance.js"];
const clientFingerprintSources = await Promise.all([
  resolve(root, "assets", "css", "app.css"),
  ...CLIENT_JS_FILES.map((file) => resolve(root, "assets", "js", file)),
].map((file) => readFile(file, "utf8")));
const buildVersion = createHash("sha256").update([sourceHtml, ...clientFingerprintSources].join("\n")).digest("hex").slice(0, 10);
const productionHtml = sourceHtml
  .replace(/\s*<!-- PRODUCTION_STRIP_LEGACY_HTML_START -->[\s\S]*?<!-- PRODUCTION_STRIP_LEGACY_HTML_END -->\s*/g, "\n");
// Cache busting. DİKKAT: index.html asset'leri kök-göreli yazıyor ("/assets/...").
// Önceki desen yalnızca "assets/..." (baştaki eğik çizgisiz) eşleştiği için HİÇ
// eşleşmiyordu ve üretilen HTML'de tek bir ?v= bile yoktu. Worker statik dosyalara
// "max-age=31536000, immutable" verdiğinden, yeni sürüm yayınlansa bile tarayıcılar
// bir yıl boyunca eski JS/CSS'i önbellekten sunabilirdi.
const versionedProductionHtml = productionHtml.replace(
  /\b(href|src)="(\/?assets\/[^"?]+)(?:\?[^"#]*)?"/g,
  `$1="$2?v=${buildVersion}"`,
);
{
  const versionedCount = (versionedProductionHtml.match(/\?v=/g) || []).length;
  const assetRefCount = (productionHtml.match(/\b(?:href|src)="\/?assets\//g) || []).length;
  if (assetRefCount > 0 && versionedCount !== assetRefCount) {
    throw new Error(`Cache busting eksik: ${assetRefCount} asset referansından ${versionedCount} tanesi sürümlendi.`);
  }
}
const routeReadyHtml = versionedProductionHtml.replace("<head>", '<head>\n<base href="/">');

if (productionHtml.includes("PRODUCTION_STRIP_LEGACY")) {
  throw new Error("Production HTML temizleme işaretleri eşleşmedi.");
}
await writeFile(resolve(dist, "client", "index.html"), routeReadyHtml);
await cp(resolve(root, "assets"), resolve(dist, "client", "assets"), { recursive: true });
await cp(resolve(root, "legal"), resolve(dist, "client", "legal"), { recursive: true });

// Minify: esbuild `transform` API'si tek dosyayı bundle etmeden küçültür ve
// top-level isimleri KORUR. Bu kritik, çünkü index.html'de 45 inline onclick
// global fonksiyon adlarına (switchMainTab, openFootballSection...) doğrudan
// referans veriyor. Bundle/IIFE moduna geçilirse bu bağ kopar.
// XYZSKOR_NO_MINIFY=1 ile hata ayıklama için kapatılabilir.
const minifyEnabled = process.env.XYZSKOR_NO_MINIFY !== "1";
const sizeReport = [];

async function minifyJs(code, label) {
  if (!minifyEnabled) return code;
  const result = await transform(code, { loader: "js", minify: true, legalComments: "none", target: "es2020" });
  if (result.warnings?.length) {
    for (const warning of result.warnings) console.warn(`[build] ${label}: ${warning.text}`);
  }
  return result.code;
}

for (const file of CLIENT_JS_FILES) {
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
  const minified = await minifyJs(productionSource, file);
  // Güvenlik ağı: inline handler'ların bağlı olduğu global adlar korunmalı.
  for (const globalName of ["switchMainTab", "openFootballSection", "switchLeagueSection"]) {
    if (productionSource.includes(`function ${globalName}`) && !minified.includes(globalName)) {
      throw new Error(`${file}: minify sonrası global ad kayboldu: ${globalName}`);
    }
  }
  sizeReport.push({ file, raw: productionSource.length, out: minified.length });
  await writeFile(targetPath, minified);
}

// CSS minify
{
  const cssSource = await readFile(resolve(root, "assets", "css", "app.css"), "utf8");
  const cssOut = minifyEnabled
    ? (await transform(cssSource, { loader: "css", minify: true, legalComments: "none" })).code
    : cssSource;
  sizeReport.push({ file: "app.css", raw: cssSource.length, out: cssOut.length });
  await writeFile(resolve(dist, "client", "assets", "css", "app.css"), cssOut);
}

await cp(resolve(root, "worker", "index.js"), resolve(dist, "server", "index.js"));
await cp(resolve(root, ".openai", "hosting.json"), resolve(dist, ".openai", "hosting.json"));

// Sites, mevcut olmayan yol isteklerini ana sayfaya yönlendirir. Bu yüzden
// paylaşılabilir ürün ve lig URL'lerini fiziksel giriş sayfaları olarak üretiriz.
const leagues = ["super-lig", "champions-league", "europa-league", "la-liga", "premier-league", "all"];
const leagueSections = ["matches", "agenda", "clubs", "transfers", "standings"];
const routeDirectories = ["predict", "basketbol", "basketbol/maclar", "basketbol/ligler", "basketbol/takimlar", "basketbol/predict", "ufc", "ufc/live", "ufc/events", "ufc/fighters", "ufc/rankings", "ufc/bouts", "ufc/maclar", "ufc/ligler", "ufc/predict", "voleybol", "voleybol/ligler", "motorsports", "motorsports/formula-1", "motorsports/formula-e", "motorsports/indycar", "motorsports/motogp", "motorsports/moto2", "motorsports/moto3", "motorsports/wrc", "motorsports/wec", "motorsports/le-mans", "motorsports/nascar", ...leagues.flatMap((league) => [
  league,
  ...leagueSections.map((section) => `${league}/${section}`),
  `${league}/transfers/talks`,
  `${league}/transfers/rumours`,
])];

for (const route of routeDirectories) {
  const target = resolve(dist, "client", ...route.split("/"), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, routeReadyHtml);
}

if (minifyEnabled) {
  const totalRaw = sizeReport.reduce((sum, row) => sum + row.raw, 0);
  const totalOut = sizeReport.reduce((sum, row) => sum + row.out, 0);
  const kb = (bytes) => (bytes / 1024).toFixed(1);
  for (const row of sizeReport) {
    console.log(`  ${row.file.padEnd(18)} ${kb(row.raw).padStart(7)} KB -> ${kb(row.out).padStart(7)} KB`);
  }
  console.log(`  ${"TOPLAM".padEnd(18)} ${kb(totalRaw).padStart(7)} KB -> ${kb(totalOut).padStart(7)} KB  (%${(100 - (100 * totalOut) / totalRaw).toFixed(0)} küçültme)`);
} else {
  console.log("  (minify kapalı: XYZSKOR_NO_MINIFY=1)");
}
console.log("XYZSKOR production build hazır: dist/");
