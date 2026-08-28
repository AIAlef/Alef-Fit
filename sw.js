/* Alef.Fit service worker — cache-first app shell for offline use.
   Bump CACHE on every release (matches APP_VERSION). */
var CACHE = 'alef-fit-v0.53.0';
var ASSETS = [
  './', './index.html', './oauth.html', './css/app.css', './manifest.webmanifest',
  './js/db.js', './js/native.js', './js/ui.js', './js/seed-data.js', './js/sync.js', './js/vaultkeep.js', './js/devtext.js', './js/app.js',
  './js/screens/exercise.js', './js/screens/discipline.js',
  './js/screens/program.js', './js/screens/retro.js', './js/screens/setting.js', './js/screens/setup.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/catbg/chest.jpg', './assets/catbg/back.jpg', './assets/catbg/leg.jpg',
  './assets/catbg/shoulder.jpg', './assets/catbg/bicep.jpg', './assets/catbg/triceps.jpg',
  './assets/catbg/abs.jpg', './assets/catbg/compound.jpg', './assets/catbg/functional.jpg',
  './assets/catbg/stretching.jpg', './assets/catbg/cardio.jpg',
  './assets/cardbg/disc-todo.jpg', './assets/cardbg/disc-note.jpg',
  './assets/cardbg/disc-bb.jpg', './assets/cardbg/disc-alarm.jpg',
  './assets/cardbg/disc-walk.jpg', './assets/cardbg/retro-cal.jpg',
  './assets/cardbg/retro-rv.jpg', './assets/cardbg/retro-wt.jpg', './assets/cardbg/retro-iw.jpg',
  './assets/progbg/pg1.jpg', './assets/progbg/pg2.jpg', './assets/progbg/pg3.jpg',
  './assets/progbg/pg4.jpg', './assets/progbg/pg5.jpg', './assets/progbg/pg6.jpg',
  './assets/progbg/pg7.jpg', './assets/progbg/pg8.jpg',
  './assets/theme/carbon.jpg', './assets/theme/steel.jpg', './assets/theme/midnight.jpg',
  './assets/theme/ember.jpg', './assets/theme/forest.jpg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    if (hit) return hit;
    return fetch(e.request).then(function (res) {
      /* runtime-cache the bundled exercise photos on first view so they
         work offline without precaching all 345 up front */
      if (res && res.ok && e.request.url.indexOf('/exercise-img/') !== -1) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    });
  }));
});
