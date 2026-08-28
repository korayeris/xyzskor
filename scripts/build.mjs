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
const CLIENT_JS_FILES = ["style-loader.js", "initial-route.js", "branch-router.js", "football-early.js", "data.js", "analytics.js", "live.js", "match-center.js", "matchday-live.js", "predict-game.js", "ui.js", "app-boot.js", "ui-extras.js", "chat.js", "multisport.js", "sport-branches.js", "motorsports.js", "ufc-hub.js", "compliance.js"];
const clientFingerprintSources = await Promise.all([
  resolve(root, "assets", "data", "motorsports-snapshot.json"),
  resolve(root, "assets", "css", "app.css"),
  resolve(root, "assets", "css", "app-late.css"),
  resolve(root, "assets", "css", "football-controls-v236.css"),
  resolve(root, "assets", "css", "football-hub.css"),
  resolve(root, "assets", "css", "volleyball-center.css"),
  resolve(root, "assets", "css", "ufc-center.css"),
  resolve(root, "assets", "css", "motorsports-center.css"),
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
// Production lets the early football request and stylesheet win the cold-load
// network race, then app-boot requests/evaluates each dependency in its own
// task. Static adjacent defer scripts collapsed into a single 300+ KB task.
const productionCoreTemplates = [
  ["data.js", "xyzDataTemplate"],
  ["analytics.js", "xyzAnalyticsTemplate"],
  ["live.js", "xyzLiveTemplate"],
  ["match-center.js", "xyzMatchCenterTemplate"],
  ["matchday-live.js", "xyzMatchdayTemplate"],
  ["predict-game.js", "xyzPredictGameTemplate"],
];
const productionPostTemplates = [
  ["chat.js", "xyzChatTemplate"],
  ["multisport.js", "xyzMultisportTemplate"],
  ["sport-branches.js", "xyzSportBranchesTemplate"],
  ["motorsports.js", "xyzMotorsportsTemplate"],
  ["ufc-hub.js", "xyzUfcHubTemplate"],
];
function moveDeferredScriptToTemplate(html, file, templateId) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<script defer src="([^"]*\\/${escaped}\\?v=[^"]+)"><\\/script>`);
  let matched = false;
  const output = html.replace(pattern, (_tag, src) => {
    matched = true;
    return `<template id="${templateId}"><script src="${src}"></script></template>`;
  });
  if (!matched) throw new Error(`Production dinamik script etiketi bulunamadi: ${file}`);
  return output;
}

const uiStageTag = `<template id="xyzUiStageTemplate"><script src="/assets/js/ui-stage.js?v=${buildVersion}"></script></template>`;
const uiRuntimeTag = `<template id="xyzUiRuntimeTemplate"><script src="/assets/js/ui-runtime.js?v=${buildVersion}"></script></template>`;
let splitUiHtml = versionedProductionHtml.replace(
  /<script defer src="(\/assets\/js\/ui\.js\?v=[^"]+)"><\/script>/,
  `<template id="xyzUiCoreTemplate"><script src="$1"></script></template>\n${uiStageTag}\n${uiRuntimeTag}`,
);
if (splitUiHtml === versionedProductionHtml) {
  throw new Error("Production UI runtime chunk etiketi eklenemedi.");
}
for (const [file, templateId] of [...productionCoreTemplates, ...productionPostTemplates]) {
  splitUiHtml = moveDeferredScriptToTemplate(splitUiHtml, file, templateId);
}
const routeReadyHtml = splitUiHtml
  .replace("<head>", `<head>\n<base href="/">`)
  // Production route documents do not need indentation-only text nodes. The
  // source remains readable, while Chromium has hundreds fewer parser nodes to
  // create on a cold mobile navigation.
  .replace(/>\s*\r?\n\s*</g, "><");

const PUBLIC_ORIGIN = "https://xyzskor-tr.korayeris2002.chatgpt.site";
const routeLabels = {
  futbol:"Futbol", all:"Tüm Ligler", "super-lig":"Süper Lig", "premier-league":"Premier League",
  "la-liga":"La Liga", bundesliga:"Bundesliga", "serie-a":"Serie A", predict:"Predict",
  basketbol:"Basketbol", voleybol:"Voleybol", ufc:"UFC", motorsports:"Motor Sporları",
  matches:"Maçlar", maclar:"Maçlar", agenda:"Gündem", clubs:"Kulüpler", takimlar:"Takımlar",
  ligler:"Ligler", transfers:"Transferler", standings:"Puan Durumu", talks:"Görüşmeler",
  rumours:"Söylentiler", live:"Canlı", events:"Etkinlikler", fighters:"Dövüşçüler",
  rankings:"Sıralamalar", bouts:"Müsabakalar", "formula-1":"Formula 1", "formula-e":"Formula E",
  indycar:"IndyCar", motogp:"MotoGP", moto2:"Moto2", moto3:"Moto3", wrc:"WRC", wec:"WEC",
  "le-mans":"Le Mans", nascar:"NASCAR",
};

function routeMetadata(route) {
  const normalized = String(route || "").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return {
      title:"Futbol · 5 Lig — XYZSKOR",
      description:"Süper Lig, Premier League, La Liga, Bundesliga ve Serie A için canlı skor, fikstür, puan durumu ve ücretsiz tahmin yarışması.",
      url:`${PUBLIC_ORIGIN}/`,
    };
  }
  const segments = normalized.split("/");
  const labels = segments.map((segment) => routeLabels[segment] || segment.replace(/(^|-)\p{L}/gu, (value) => value.replace("-", " ").toUpperCase()));
  const product = segments[0];
  const descriptions = {
    futbol:"Beş büyük lig için canlı skor, fikstür, puan durumu, kadro ve maç verileri.",
    all:"Süper Lig ve Avrupa'nın dört büyük ligi için birleşik canlı skor ve fikstür görünümü.",
    predict:"Ücretsiz futbol tahmin yarışmasına katıl, skorunu takip et ve haftalık sıralamada yerini gör.",
    basketbol:"Basketbol maçları, ligler, takımlar ve güncel skor akışı.",
    voleybol:"Voleybol maçları, ligler, takımlar ve güncel skor akışı.",
    ufc:"UFC etkinlikleri, dövüş kartları, sporcu profilleri ve sıralamalar.",
    motorsports:"Formula 1, MotoGP, WRC, WEC ve diğer motor sporları için takvim, sonuç ve sıralamalar.",
    "super-lig":"Süper Lig canlı skorları, fikstürü, puan durumu, transferleri ve takım verileri.",
    "premier-league":"Premier League canlı skorları, fikstürü, puan durumu, transferleri ve takım verileri.",
    "la-liga":"La Liga canlı skorları, fikstürü, puan durumu, transferleri ve takım verileri.",
    bundesliga:"Bundesliga canlı skorları, fikstürü, puan durumu, transferleri ve takım verileri.",
    "serie-a":"Serie A canlı skorları, fikstürü, puan durumu, transferleri ve takım verileri.",
  };
  return {
    title:`${labels.join(" · ")} — XYZSKOR`,
    description:descriptions[product] || "XYZSKOR canlı skor, spor verisi ve analiz merkezi.",
    url:`${PUBLIC_ORIGIN}/${normalized}/`,
  };
}

function escapeHtmlAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function withRouteMetadata(html, route) {
  const metadata = routeMetadata(route);
  const title = escapeHtmlAttribute(metadata.title);
  const description = escapeHtmlAttribute(metadata.description);
  const url = escapeHtmlAttribute(metadata.url);
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${description}">`)
    .replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${url}">`)
    .replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${description}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${description}">`);
}

function markerBounds(html, marker, label) {
  const startMarker = `<!-- ${marker}_START -->`;
  const endMarker = `<!-- ${marker}_END -->`;
  const start = html.indexOf(startMarker);
  const end = start >= 0 ? html.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end <= start) throw new Error(`Production HTML isaretleri bulunamadi: ${label}`);
  return { start, contentStart:start + startMarker.length, end, blockEnd:end + endMarker.length };
}
function markedContent(html, marker, label) {
  const bounds = markerBounds(html, marker, label);
  return html.slice(bounds.contentStart, bounds.end);
}
function removeMarkedBlock(html, marker, label) {
  const bounds = markerBounds(html, marker, label);
  return html.slice(0, bounds.start) + html.slice(bounds.blockEnd);
}

const canonicalFragments = {
  "matchday.html": markedContent(routeReadyHtml, "XYZ_FRAGMENT_MATCHDAY", "matchday"),
  "account-auth.html": [
    markedContent(routeReadyHtml, "XYZ_FRAGMENT_ACCOUNT", "account"),
    markedContent(routeReadyHtml, "XYZ_FRAGMENT_AUTH", "auth"),
  ].join(""),
  "news-match.html": [
    markedContent(routeReadyHtml, "XYZ_FRAGMENT_NEWS", "news"),
    markedContent(routeReadyHtml, "XYZ_FRAGMENT_MATCH_CENTER", "match-center"),
  ].join(""),
  "mobile.html": markedContent(routeReadyHtml, "XYZ_FRAGMENT_MOBILE", "mobile-nav"),
  "chat.html": markedContent(routeReadyHtml, "XYZ_FRAGMENT_CHAT", "chat"),
};

// The aggregate root and bare league homes render from the early/canonical
// football targets. Their hidden legacy home, section and Predict DOM is never
// needed during the cold route. Section and product documents keep the full
// source HTML below, so this is a route-specific production optimization only.
let canonicalLeanHtml = routeReadyHtml
  .replace(
    /<div id="weekSelector"[\s\S]*?(?=<div class="tabpage" id="page-league">)/,
    "</div></div>",
  )
  .replace(
    /<div class="tabpage" id="page-league">[\s\S]*?(?=<!-- XYZ_CANONICAL_LATE_LEGACY_LIVE_START -->)/,
    "",
  );
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_CANONICAL_LATE_FOOTBALL_PRELUDE", "football-prelude");
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_CANONICAL_LATE_LEGACY_LIVE", "legacy-live");
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_FRAGMENT_ACCOUNT", "account");
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_FRAGMENT_NEWS", "news");
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_FRAGMENT_MATCH_CENTER", "match-center");
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_FRAGMENT_AUTH", "auth");
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_FRAGMENT_MOBILE", "mobile-nav");
canonicalLeanHtml = removeMarkedBlock(canonicalLeanHtml, "XYZ_FRAGMENT_CHAT", "chat");
if (canonicalLeanHtml === routeReadyHtml
  || canonicalLeanHtml.includes('id="weekSelector"')
  || canonicalLeanHtml.includes('id="footballMatchesView"')
  || canonicalLeanHtml.includes('id="page-league"')) {
  throw new Error("Canonical lean football shell ayıklanamadı.");
}
for (const essentialId of ["footballScoreboardHome", "footballLeagueOverview", "navRight", "liveTicker"]) {
  if (!canonicalLeanHtml.includes(`id="${essentialId}"`)) throw new Error(`Canonical lean shell temel hedefi eksik: ${essentialId}`);
}
for (const lateId of ["footballContextNav", "footballLeagueCommand", "matchdayCommand", "miniGoalGame", "page-live", "accountOverlay", "authOverlay", "newsOverlay", "mcOverlay", "mobileBottomNav", "chatLauncher", "chatPanel"]) {
  if (canonicalLeanHtml.includes(`id="${lateId}"`)) throw new Error(`Canonical lean shell gec DOM hedefini tasiyor: ${lateId}`);
}
const fragmentContracts = {
  "matchday.html":["matchdayCommand", "matchdayLiveRoot"],
  "account-auth.html":["accountOverlay", "accountClose", "authOverlay", "authSubmit"],
  "news-match.html":["newsOverlay", "newsDetailClose", "mcOverlay", "mcTabs"],
  "mobile.html":["mobileBottomNav"],
  "chat.html":["chatLauncher", "chatPanel", "chatRoomList"],
};
for (const [file, ids] of Object.entries(fragmentContracts)) {
  for (const id of ids) {
    if (!canonicalFragments[file].includes(`id="${id}"`)) throw new Error(`Production fragment hedefi eksik: ${file}#${id}`);
  }
}
if (!routeReadyHtml.includes('id="page-league"') || !routeReadyHtml.includes('id="footballMatchesView"')) {
  throw new Error("Tam route HTML'i section/Predict hedeflerini korumalı.");
}

for (const templateId of [
  "xyzDataTemplate", "xyzAnalyticsTemplate", "xyzLiveTemplate", "xyzMatchCenterTemplate", "xyzMatchdayTemplate",
  "xyzPredictGameTemplate", "xyzUiCoreTemplate", "xyzUiStageTemplate", "xyzUiRuntimeTemplate",
  "xyzUiExtrasTemplate", "xyzChatTemplate", "xyzMultisportTemplate", "xyzSportBranchesTemplate",
  "xyzMotorsportsTemplate", "xyzUfcHubTemplate",
]) {
  if (!routeReadyHtml.includes(`id="${templateId}"`)) {
    throw new Error(`Production dinamik script sablonu eksik: ${templateId}`);
  }
}

if (productionHtml.includes("PRODUCTION_STRIP_LEGACY")) {
  throw new Error("Production HTML temizleme işaretleri eşleşmedi.");
}
await writeFile(resolve(dist, "client", "index.html"), withRouteMetadata(canonicalLeanHtml, ""));
await cp(resolve(root, "assets"), resolve(dist, "client", "assets"), { recursive: true });
await cp(resolve(root, "legal"), resolve(dist, "client", "legal"), { recursive: true });
const fragmentDirectory = resolve(dist, "client", "assets", "fragments");
await mkdir(fragmentDirectory, { recursive: true });
for (const [file, html] of Object.entries(canonicalFragments)) {
  await writeFile(resolve(fragmentDirectory, file), html);
}

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
  let productionSource = source.replace(
    /\s*\/\* PRODUCTION_STRIP_LEGACY_JS_START \*\/[\s\S]*?\/\* PRODUCTION_STRIP_LEGACY_JS_END \*\/\s*/g,
    "\n",
  );
  if (file === "motorsports.js") {
    const snapshotPath = "/assets/data/motorsports-snapshot.json";
    const versionedSnapshotPath = `${snapshotPath}?v=${buildVersion}`;
    productionSource = productionSource.replace(snapshotPath, versionedSnapshotPath);
    if (!productionSource.includes(versionedSnapshotPath)) {
      throw new Error("Motor sporları snapshot URL'si build sürümüyle eşleşmedi.");
    }
  }
  if (productionSource.includes("PRODUCTION_STRIP_LEGACY")) {
    throw new Error(`${file} production temizleme işaretleri eşleşmedi.`);
  }
  if (file === "ui.js") {
    const stageMarker = "function fmtEditorialDate(value){";
    const runtimeMarker = "function leagueOverviewCountry(key){";
    const stageIndex = productionSource.indexOf(stageMarker);
    const runtimeIndex = productionSource.indexOf(runtimeMarker);
    if (stageIndex <= 0 || runtimeIndex <= stageIndex) throw new Error("ui.js production stage/runtime bölme sınırı bulunamadı.");
    const chunks = [
      { file:"ui.js", source:productionSource.slice(0, stageIndex) },
      { file:"ui-stage.js", source:productionSource.slice(stageIndex, runtimeIndex) },
      { file:"ui-runtime.js", source:productionSource.slice(runtimeIndex) },
    ];
    const outputs = [];
    for (const chunk of chunks) {
      const output = await minifyJs(chunk.source, chunk.file);
      outputs.push(output);
      sizeReport.push({ file:chunk.file, raw:chunk.source.length, out:output.length });
      await writeFile(resolve(root, "dist", "client", "assets", "js", chunk.file), output);
    }
    for (const globalName of ["switchMainTab", "openFootballSection", "switchLeagueSection"]) {
      if (productionSource.includes(`function ${globalName}`) && !outputs.some(output=>output.includes(globalName))) {
        throw new Error(`${file}: minify sonrası global ad kayboldu: ${globalName}`);
      }
    }
    continue;
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

// CSS minify. Üç katmanlı stil ayrımı cascade sırasını korurken tarayıcının
// 600+ KB stili tek uzun ana-thread görevinde ayrıştırmasını önler.
for (const cssFile of ["football-hub.css", "app.css", "app-late.css", "volleyball-center.css", "ufc-center.css", "motorsports-center.css"]) {
  const cssSource = await readFile(resolve(root, "assets", "css", cssFile), "utf8");
  const cssOut = minifyEnabled
    ? (await transform(cssSource, { loader: "css", minify: true, legalComments: "none" })).code
    : cssSource;
  sizeReport.push({ file: cssFile, raw: cssSource.length, out: cssOut.length });
  await writeFile(resolve(dist, "client", "assets", "css", cssFile), cssOut);
}

await cp(resolve(root, "worker", "index.js"), resolve(dist, "server", "index.js"));
await cp(resolve(root, ".openai", "hosting.json"), resolve(dist, ".openai", "hosting.json"));
await cp(resolve(root, "site.webmanifest"), resolve(dist, "client", "site.webmanifest"));

// Sites, mevcut olmayan yol isteklerini ana sayfaya yönlendirir. Bu yüzden
// paylaşılabilir ürün ve lig URL'lerini fiziksel giriş sayfaları olarak üretiriz.
const leagues = ["super-lig", "la-liga", "premier-league", "bundesliga", "serie-a", "all"];
const leagueSections = ["matches", "agenda", "clubs", "transfers", "standings"];
const routeDirectories = ["predict", "futbol", "basketbol", "basketbol/maclar", "basketbol/ligler", "basketbol/takimlar", "basketbol/predict", "ufc", "ufc/live", "ufc/events", "ufc/fighters", "ufc/rankings", "ufc/bouts", "ufc/maclar", "ufc/ligler", "ufc/predict", "voleybol", "voleybol/maclar", "voleybol/ligler", "voleybol/takimlar", "voleybol/predict", "motorsports", "motorsports/formula-1", "motorsports/formula-e", "motorsports/indycar", "motorsports/motogp", "motorsports/moto2", "motorsports/moto3", "motorsports/wrc", "motorsports/wec", "motorsports/le-mans", "motorsports/nascar", ...leagues.flatMap((league) => [
  league,
  ...leagueSections.map((section) => `${league}/${section}`),
  `${league}/transfers/talks`,
  `${league}/transfers/rumours`,
])];

for (const route of routeDirectories) {
  const target = resolve(dist, "client", ...route.split("/"), "index.html");
  await mkdir(dirname(target), { recursive: true });
  // `futbol` beş ligli futbol kökü olduğu için lig rotalarıyla aynı lean
  // gövdeyi alır; branş rotaları legacy yerleşimi eager isteyen gövdeyi alır.
  const routeHtml = leagues.includes(route) || route === "futbol" ? canonicalLeanHtml : routeReadyHtml;
  await writeFile(target, withRouteMetadata(routeHtml, route));
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
