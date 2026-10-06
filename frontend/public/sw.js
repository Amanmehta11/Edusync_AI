const CACHE_NAME = "edusync-v6";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache basic application shell
      await cache.addAll(APP_SHELL);

      // Read index.html to find Vite-generated JS and CSS files
      const response = await fetch("/index.html");
      const html = await response.text();

      const assets = [];

      // Find JavaScript files
      for (const match of html.matchAll(
        /<script[^>]+src=["']([^"']+)["']/g
      )) {
        assets.push(match[1]);
      }

      // Find CSS files
      for (const match of html.matchAll(
        /<link[^>]+href=["']([^"']+\.css)["']/g
      )) {
        assets.push(match[1]);
      }

      console.log("Assets found:", assets);

      // Cache all discovered production assets
      await Promise.all(
        assets.map(async (asset) => {
          try {
            const assetResponse = await fetch(asset);

            if (assetResponse.ok) {
              await cache.put(asset, assetResponse.clone());
              console.log("Cached:", asset);
            } else {
              console.error(
                "Failed to cache:",
                asset,
                assetResponse.status
              );
            }
          } catch (error) {
            console.error("Failed to cache:", asset, error);
          }
        })
      );
    })
  );

  self.skipWaiting();
});


self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );

  self.clients.claim();
});


self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const request = event.request;


  // -----------------------------------------------------
  // STATIC ASSETS
  // -----------------------------------------------------

  const isStaticAsset =
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {

        // If asset exists in cache, use it immediately
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise try network
        return fetch(request)
          .then((response) => {

            if (response.ok) {
              const copy = response.clone();

              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, copy);
              });
            }

            return response;
          })
          .catch(() => {
            return new Response("", {
              status: 503,
              statusText: "Offline",
            });
          });
      })
    );

    return;
  }


  // -----------------------------------------------------
  // PAGE NAVIGATION
  // -----------------------------------------------------

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put("/index.html", copy);
          });

          return response;
        })
        .catch(() => {
          return caches.match("/index.html");
        })
    );

    return;
  }


  // -----------------------------------------------------
  // OTHER GET REQUESTS
  // -----------------------------------------------------

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {

          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(() => {
          return new Response("", {
            status: 503,
            statusText: "Offline",
          });
        });
    })
  );
});