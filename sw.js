const CACHE_NAME = 'site-pwa-v2';
const ACCESS_DAYS = 60; // дней использования с первого запуска

// ── IndexedDB helpers ──────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pwa-meta', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    const req = tx.objectStore('kv').put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Получить (или записать) дату первого запуска ──────────────────────────
async function getOrSetFirstLaunch() {
  const db = await openDB();
  let firstLaunch = await dbGet(db, 'firstLaunch');
  if (!firstLaunch) {
    firstLaunch = Date.now();
    await dbPut(db, 'firstLaunch', firstLaunch);
  }
  return firstLaunch;
}

// ── Страница «срок истёк» ─────────────────────────────────────────────────
function expiredResponse() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Марафон завершён</title>
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
    }
    h1 {
      font-size: 2.5rem;
      margin: 0 0 1rem;
      animation: fadeIn 1s ease-out;
    }
    p {
      font-size: 1.2rem;
      opacity: 0.9;
      line-height: 1.6;
      animation: fadeIn 1.5s ease-out;
    }
    .emoji {
      font-size: 4rem;
      margin-bottom: 1rem;
      animation: bounce 2s infinite;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50%       { transform: translateY(-20px); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="emoji">🎉</div>
    <h1>Поздравляем!</h1>
    <p>Вы успешно завершили марафон!</p>
    <p style="font-size: 0.9rem; margin-top: 2rem; opacity: 0.7;">
      Срок доступа (60 дней) истёк
    </p>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 403,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ── Service Worker events ─────────────────────────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // НЕ кешируй видео с BotHelp
  if (url.hostname.includes('bothelp')) return;

  event.respondWith(
    (async () => {
      const firstLaunch = await getOrSetFirstLaunch();
      const expiryMs = firstLaunch + ACCESS_DAYS * 24 * 60 * 60 * 1000;

      if (Date.now() >= expiryMs) {
        return expiredResponse();
      }

      // До истечения срока — работаем нормально
      try {
        const response = await fetch(event.request);
        if (response.status === 200 && event.request.method === 'GET') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error('Нет сети и нет кэша');
      }
    })()
  );
});

