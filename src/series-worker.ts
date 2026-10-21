import { isQuote } from "./quote.ts"
import type { PriceSeries } from "./present.ts"

const batchSize = 2500

const response = await fetch(`${import.meta.env.BASE_URL}data/series.json`, { cache: "no-store" })
if (!response.ok) {
  postMessage({ type: "empty" })
} else {
  const text = await response.text()
  const parsed: unknown = text.startsWith("{") ? JSON.parse(text) : null
  if (typeof parsed !== "object" || parsed === null || !("quotes" in parsed) || !Array.isArray(parsed.quotes)) {
    postMessage({ type: "empty" })
  } else {
    const quotes: PriceSeries["quotes"][number][] = []
    let valid = true
    for (const item of parsed.quotes) {
      if (!isQuote(item)) {
        valid = false
        break
      }
      quotes.push(item)
    }
    if (!valid) {
      postMessage({ type: "empty" })
    } else {
      for (let index = 0; index < quotes.length; index += batchSize) {
        postMessage({ type: "batch", quotes: quotes.slice(index, index + batchSize) })
      }
      postMessage({ type: "done" })
    }
  }
}
