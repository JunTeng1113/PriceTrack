import { afterEach, describe, expect, test } from "vitest"
import { readThroughCache } from "../src/cached-fetch.ts"

type Stored = Map<string, string>

function installCache(stored: Stored): void {
  const store = {
    match(url: string): Promise<Response | undefined> {
      const text = stored.get(url)
      if (text === undefined) {
        return Promise.resolve(undefined)
      }
      return Promise.resolve(new Response(text))
    },
    put(url: string, response: Response): Promise<void> {
      return response.text().then((text) => {
        stored.set(url, text)
      })
    },
  }
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      open(): Promise<typeof store> {
        return Promise.resolve(store)
      },
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "caches")
  Reflect.deleteProperty(globalThis, "fetch")
})

describe("讀取快取", () => {
  test("有快取時先交出舊資料，網路更新後再交出新資料", async () => {
    const stored: Stored = new Map([["/data/used.json", "{\"posts\":[1]}"]])
    installCache(stored)
    let release = (_response: Response): void => {
      void _response
    }
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: () =>
        new Promise<Response>((resolve) => {
          release = resolve
        }),
    })
    const seen: string[] = []
    const pending = readThroughCache("/data/used.json", (text) => {
      seen.push(text)
    })
    for (let step = 0; step < 20 && seen.length === 0; step += 1) {
      await Promise.resolve()
    }
    expect(seen).toEqual(["{\"posts\":[1]}"])
    release(new Response("{\"posts\":[1,2]}", { status: 200 }))
    await expect(pending).resolves.toBe(true)
    expect(seen).toEqual(["{\"posts\":[1]}", "{\"posts\":[1,2]}"])
    expect(stored.get("/data/used.json")).toBe("{\"posts\":[1,2]}")
  })

  test("網路失敗時仍使用快取", async () => {
    const stored: Stored = new Map([["/data/series.json", "{\"quotes\":[]}"]])
    installCache(stored)
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: () => Promise.reject(new Error("offline")),
    })
    const seen: string[] = []
    const delivered = await readThroughCache("/data/series.json", (text) => {
      seen.push(text)
    })
    expect(delivered).toBe(true)
    expect(seen).toEqual(["{\"quotes\":[]}"])
  })
})
