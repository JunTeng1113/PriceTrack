import { readThroughCache } from "./cached-fetch.ts"
import { isQuote } from "./quote.ts"
import type { PriceSeries } from "./present.ts"

const batchSize = 2500
const url = `${import.meta.env.BASE_URL}data/series.json`
let posted = false

function publish(text: string): void {
  if (posted) {
    postMessage({ type: "reset" })
  }
  posted = true
  const parsed: unknown = text.startsWith("{") ? JSON.parse(text) : null
  if (typeof parsed !== "object" || parsed === null || !("quotes" in parsed) || !Array.isArray(parsed.quotes)) {
    postMessage({ type: "empty" })
    return
  }
  const quotes: PriceSeries["quotes"][number][] = []
  for (const item of parsed.quotes) {
    if (!isQuote(item)) {
      postMessage({ type: "empty" })
      return
    }
    quotes.push(item)
  }
  for (let index = 0; index < quotes.length; index += batchSize) {
    postMessage({ type: "batch", quotes: quotes.slice(index, index + batchSize) })
  }
  postMessage({ type: "done" })
}

const delivered = await readThroughCache(url, publish)
if (!delivered && !posted) {
  postMessage({ type: "empty" })
}
