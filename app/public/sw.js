// O build (package.json) troca o marcador abaixo por um hash novo a cada deploy:
// muda o nome do cache (limpa o antigo no activate) e o próprio sw.js (dispara a atualização).
const CACHE_NAME = 'senta-pua-' + '__BUILD_HASH__';
const PRECACHE = ['/logo.png', '/sabre.png', '/manifest.json'];

self.addEventListener('install', (e) => {
  // NÃO chamar skipWaiting aqui: o SW novo fica "esperando" até o usuário
  // clicar "Atualizar agora" (que dispara o SKIP_WAITING via postMessage).
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Uma resposta só pode ir para o cache se for o próprio arquivo pedido.
// Quando um arquivo de uma versão antiga some do servidor, o Pages devolve o index.html
// (status 200) no lugar dele; guardar isso no cache travava a tela em branco até limpar o cache.
function podeGuardar(req, res) {
  if (!res || !res.ok || res.type === 'opaque') return false;
  const tipo = res.headers.get('content-type') || '';
  if (req.destination === 'script' || req.destination === 'style' || /\.(js|css)$/.test(new URL(req.url).pathname)) {
    return !tipo.includes('text/html');
  }
  return true;
}

self.addEventListener('fetch', (e) => {
  // Cache API só suporta GET — nunca interceptar POST/PUT/DELETE (quebra com erro).
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Outros domínios e API: direto na rede (nunca cacheia dados)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;

  // Navegação (HTML): sempre a versão nova da rede; o cache só serve quando está offline
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
          }
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Arquivos do build (/assets/ com hash no nome, imutáveis): cache primeiro
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (podeGuardar(e.request, res)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Demais arquivos públicos (logo, manifest, imagens): rede primeiro, cache se offline
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (podeGuardar(e.request, res)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
