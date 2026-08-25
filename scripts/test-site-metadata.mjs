import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicOrigin = "https://xyzskor-tr.korayeris2002.chatgpt.site";

async function pngDimensions(path) {
  const bytes = await readFile(path);
  assert.equal(bytes.toString("ascii", 1, 4), "PNG", `${path} geçerli PNG olmalı.`);
  return { width:bytes.readUInt32BE(16), height:bytes.readUInt32BE(20) };
}

function metaContent(html, attribute, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta ${attribute}="${escaped}" content="([^"]*)"`, "i"))?.[1] || "";
}

const sourceHtml = await readFile(resolve(root, "index.html"), "utf8");
const manifest = JSON.parse(await readFile(resolve(root, "site.webmanifest"), "utf8"));
assert.equal(manifest.id, "/");
assert.equal(manifest.scope, "/");
assert.ok(manifest.start_url.startsWith("/"));
assert.ok(["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"].includes(manifest.display));
assert.ok(manifest.name && manifest.short_name);
assert.match(sourceHtml, /<link rel="manifest" href="\/site\.webmanifest">/);
assert.match(sourceHtml, /<meta name="theme-color" content="#0c0f12">/);
assert.equal(metaContent(sourceHtml, "name", "twitter:card"), "summary_large_image");
assert.equal(metaContent(sourceHtml, "property", "og:image:width"), "1200");
assert.equal(metaContent(sourceHtml, "property", "og:image:height"), "630");

const requiredIcons = new Map([["192x192", [192, 192]], ["512x512", [512, 512]]]);
for (const [size, expected] of requiredIcons) {
  const icon = manifest.icons.find((entry) => entry.sizes === size);
  assert.ok(icon, `Manifest ${size} ikonunu içermeli.`);
  const dimensions = await pngDimensions(resolve(root, icon.src.replace(/^\//, "")));
  assert.deepEqual([dimensions.width, dimensions.height], expected, `${size} ikon ölçüsü doğru olmalı.`);
}
const socialDimensions = await pngDimensions(resolve(root, "assets", "images", "social", "xyzskor-social-card.png"));
assert.deepEqual(socialDimensions, { width:1200, height:630 });

const appCss = await readFile(resolve(root, "assets", "css", "app.css"), "utf8");
const lateCss = await readFile(resolve(root, "assets", "css", "app-late.css"), "utf8");
assert.doesNotMatch(appCss, /url\(['"]assets\/campaigns\//, "CSS içinden yanlış göreli kampanya yolu kalmamalı.");
for (const path of [
  "assets/campaigns/fan-vote-challenge.webp",
  "assets/campaigns/mythos-cards-weekly.webp",
  "assets/campaigns/signed-jersey-grand-prize.webp",
  "assets/images/sports/motorsport-cinematic-v1.webp",
  "assets/images/sports/multisport-icons-v1.webp",
  "assets/images/sports/ufc-arena-v1.webp",
]) {
  await access(resolve(root, path));
  assert.ok(appCss.includes(`/${path}`) || lateCss.includes(`/${path}`), `${path} üretim CSS'inde kullanılmalı.`);
}

const distRoot = resolve(root, "dist", "client");
try {
  await access(resolve(distRoot, "index.html"));
  const routes = ["", "futbol", "predict", "voleybol", "ufc", "motorsports"];
  const titles = new Set();
  const descriptions = new Set();
  for (const route of routes) {
    const html = await readFile(resolve(distRoot, ...(route ? route.split("/") : []), "index.html"), "utf8");
    const expectedUrl = route ? `${publicOrigin}/${route}/` : `${publicOrigin}/`;
    const canonical = html.match(/<link rel="canonical" href="([^"]*)">/i)?.[1] || "";
    assert.equal(canonical, expectedUrl, `${route || "/"} canonical URL'si rotaya özgü olmalı.`);
    assert.equal(metaContent(html, "property", "og:url"), expectedUrl, `${route || "/"} og:url canonical ile eşleşmeli.`);
    assert.equal(metaContent(html, "name", "twitter:card"), "summary_large_image");
    titles.add(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    descriptions.add(metaContent(html, "name", "description"));
  }
  assert.equal(titles.size, routes.length, "Temel ürün rotalarının title değerleri benzersiz olmalı.");
  assert.equal(descriptions.size, routes.length, "Temel ürün rotalarının açıklamaları benzersiz olmalı.");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log("Site metadata, installability and visual asset contract: PASS");
