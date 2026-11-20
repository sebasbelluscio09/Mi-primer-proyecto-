/* Service worker de Agenda de Gira: permite abrir la app sin internet.
   - Archivos de la app: primero la red (para recibir actualizaciones), si no hay red, la copia guardada.
   - Librerías externas y mosaicos del mapa: primero la copia guardada.
   - Supabase (datos) nunca se intercepta: los datos sin conexión los guarda la app aparte. */
const VERSION = 'v8';
const CACHE_APP = 'gira-app-' + VERSION;
const CACHE_LIBS = 'gira-libs-v1';
const CACHE_MAPA = 'gira-mapa-v1';

const APP = ['./', './index.html', './css/styles.css', './js/config.js', './js/app.js',
  './icon.svg', './icon-180.png', './icon-512.png', './manifest.webmanifest'];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];
const HOSTS_LIBS = ['cdn.jsdelivr.net', 'unpkg.com'];
const MAX_MOSAICOS = 600;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const app = await caches.open(CACHE_APP);
    await Promise.all(APP.map((u) => app.add(u).catch(() => {})));
    const libs = await caches.open(CACHE_LIBS);
    await Promise.all(LIBS.map(async (u) => {
      if (!(await libs.match(u))) await libs.add(new Request(u, { mode: 'cors' })).catch(() => {});
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const vigentes = [CACHE_APP, CACHE_LIBS, CACHE_MAPA];
    for (const k of await caches.keys()) if (!vigentes.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function primeroRed(req) {
  const cache = await caches.open(CACHE_APP);
  try {
    const resp = await fetch(req);
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err) {
    const guardada = await cache.match(req, { ignoreSearch: true });
    if (guardada) return guardada;
    if (req.mode === 'navigate') {
      const inicio = await cache.match('./index.html');
      if (inicio) return inicio;
    }
    throw err;
  }
}

async function primeroCache(req, nombre, limite) {
  const cache = await caches.open(nombre);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const resp = await fetch(req);
  if (resp.ok || resp.type === 'opaque') {
    await cache.put(req, resp.clone());
    if (limite) {
      const claves = await cache.keys();
      for (let i = 0; i < claves.length - limite; i++) await cache.delete(claves[i]);
    }
  }
  return resp;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(primeroRed(req)); return; }
  if (HOSTS_LIBS.includes(url.hostname)) { e.respondWith(primeroCache(req, CACHE_LIBS)); return; }
  if (url.hostname === 'tile.openstreetmap.org') { e.respondWith(primeroCache(req, CACHE_MAPA, MAX_MOSAICOS)); }
});
