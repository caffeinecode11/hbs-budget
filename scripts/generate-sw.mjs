import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const indexHtml = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const discoveredAssets = [...indexHtml.matchAll(/(?:src|href)="\.\/(assets\/[^\"]+)"/g)].map(
  (match) => `./${match[1]}`,
);
const shellFiles = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  ...discoveredAssets,
];
const versionHash = createHash("sha256");
for (const file of shellFiles.filter((item) => item !== "./")) {
  versionHash.update(file);
  versionHash.update(await readFile(new URL(`../dist/${file.replace(/^\.\//, "")}`, import.meta.url)));
}
const version = versionHash.digest("hex").slice(0, 12);

const serviceWorker = `const CACHE_NAME = "hbs-budget-shell-${version}";
const APP_SHELL = ${JSON.stringify(shellFiles, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(caches.match("./index.html").then((cached) => cached || fetch(event.request)));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
`;

await writeFile(new URL("../dist/sw.js", import.meta.url), serviceWorker, "utf8");
