const CACHE = 'study-timer-v3';
const FILES = ['./index.html', './manifest.json', './playlist.json', './characters.json', './icon-192.png', './icon-512.png'];

// Files that change whenever the app is updated — always prefer the network,
// falling back to cache only when offline. This is what actually fixes the
// "I edited index.html but forgot to bump the cache" problem: even if this
// exact file is untouched, HTML/JSON always re-check the network first.
const SHELL_FILES = ['index.html', 'manifest.json', 'playlist.json', 'characters.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Cache each shell file independently — if one is missing (e.g. characters.json
      // before you've added one yet) it shouldn't block the rest from being cached.
      Promise.all(FILES.map(f => c.add(f).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

function isShellRequest(url){
  const path = url.pathname.split('/').pop() || 'index.html';
  return SHELL_FILES.indexOf(path) !== -1 || url.pathname.endsWith('/');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  if (isShellRequest(url)) {
    // Network-first: always get the latest app shell when online.
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else (sound clips, character images, icons): cache-first,
  // since these are large, rarely change, and are exactly what we want
  // available offline once played/shown once.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
