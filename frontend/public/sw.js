const CACHE_NAME = "edusync-v7";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(APP_SHELL);

      try {
        const response = await fetch("/index.html");
        const html = await response.text();

        const jsMatches = [
          ...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)
        ];

        const cssMatches = [
          ...html.matchAll(/<link[^>]+href=["']([^"']+\.css)["']/g)
        ];

        const assets = [
          ...jsMatches.map(match => match[1]),
          ...cssMatches.map(match => match[1])
        ];

        for (const asset of assets) {
          try {
            await cache.add(asset);
          } catch (error) {
            console.warn("Could not cache asset:", asset);
          }
        }
      } catch (error) {
        console.warn("Could not pre-cache Vite assets:", error);
      }
    })
  );

  self.skipWaiting();
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});


self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);


  // --------------------------------------------------
  // 1. React / CSS / JS / images / fonts
  // --------------------------------------------------

  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request, {
        ignoreSearch: true,
        ignoreVary: true
      }).then(cachedResponse => {

        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(response => {

          if (response && response.ok) {
            const responseClone = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }

          return response;
        });
      }).catch(() => {
        return new Response("", {
          status: 503,
          statusText: "Offline"
        });
      })
    );

    return;
  }


  // --------------------------------------------------
  // 2. API requests
  // --------------------------------------------------

  if (url.hostname === "127.0.0.1" && url.port === "8000") {

    event.respondWith(
      fetch(request)
        .then(response => {

          if (response && response.ok) {
            const responseClone = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }

          return response;
        })
        .catch(() => {

          return caches.match(request, {
            ignoreSearch: true,
            ignoreVary: true
          }).then(cachedResponse => {

            if (cachedResponse) {
              return cachedResponse;
            }

            return new Response(
              JSON.stringify({
                offline: true,
                message: "No cached data available."
              }),
              {
                status: 503,
                headers: {
                  "Content-Type": "application/json"
                }
              }
            );
          });
        })
    );

    return;
  }


  // --------------------------------------------------
  // 3. Page navigation
  // --------------------------------------------------

  if (request.mode === "navigate") {

    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() =>
          caches.match("/index.html", {
            ignoreVary: true
          })
        )
    );

    return;
  }


  // --------------------------------------------------
  // 4. Other GET requests
  // --------------------------------------------------

  event.respondWith(
    fetch(request)
      .then(response => response)
      .catch(() =>
        caches.match(request, {
          ignoreSearch: true,
          ignoreVary: true
        })
      )
  );
});