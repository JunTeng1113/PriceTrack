const cacheName = "pricetrack-data"

function cacheStore(): Promise<Cache | null> {
  if (!("caches" in globalThis)) {
    return Promise.resolve(null)
  }
  return caches.open(cacheName).then(
    (store) => store,
    () => null,
  )
}

function cachedText(store: Cache | null, url: string): Promise<string> {
  if (store === null) {
    return Promise.resolve("")
  }
  return store.match(url).then(
    (hit) => {
      if (hit === undefined) {
        return ""
      }
      return hit.text().then(
        (text) => text,
        () => "",
      )
    },
    () => "",
  )
}

function storeText(store: Cache | null, url: string, text: string): Promise<void> {
  if (store === null) {
    return Promise.resolve()
  }
  const body = new Response(text, { headers: { "content-type": "application/json" } })
  return store.put(url, body).then(
    () => undefined,
    () => undefined,
  )
}

export function readThroughCache(url: string, apply: (text: string) => void): Promise<boolean> {
  return cacheStore().then((store) =>
    cachedText(store, url).then((previous) => {
      if (previous.startsWith("{")) {
        apply(previous)
      }
      return fetch(url, { cache: "reload" }).then(
        (response) => {
          if (!response.ok) {
            return previous.startsWith("{")
          }
          return response.text().then((text) => {
            if (!text.startsWith("{")) {
              return previous.startsWith("{")
            }
            return storeText(store, url, text).then(() => {
              if (text !== previous) {
                apply(text)
              }
              return true
            })
          })
        },
        () => previous.startsWith("{"),
      )
    }),
  )
}
