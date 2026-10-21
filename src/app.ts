import { start } from "./browse.ts"
import { demoSeries } from "./main.ts"
import type { PriceSeries } from "./present.ts"

const response = await fetch("/data/series.json", { cache: "no-store" })
if (!response.ok) {
  start(demoSeries())
} else {
  const text = await response.text()
  const series = text.startsWith("{") ? readPrepared(JSON.parse(text) as unknown) : null
  start(series === null || series.quotes.length === 0 ? demoSeries() : series)
}

function readPrepared(value: unknown): PriceSeries | null {
  if (typeof value !== "object" || value === null || !("quotes" in value) || !Array.isArray(value.quotes)) {
    return null
  }
  const quotes: PriceSeries["quotes"][number][] = []
  for (const item of value.quotes) {
    if (!isQuote(item)) {
      return null
    }
    quotes.push(item)
  }
  return { quotes }
}

function isQuote(value: unknown): value is PriceSeries["quotes"][number] {
  if (typeof value !== "object" || value === null) {
    return false
  }
  if (!("code" in value) || typeof value.code !== "string") {
    return false
  }
  if (!("date" in value) || typeof value.date !== "string") {
    return false
  }
  if (!("sellingPrice" in value) || typeof value.sellingPrice !== "number") {
    return false
  }
  if (!("group" in value) || typeof value.group !== "string") {
    return false
  }
  if (!("rowText" in value) || typeof value.rowText !== "string") {
    return false
  }
  if (!("capturedAt" in value) || typeof value.capturedAt !== "string") {
    return false
  }
  if (!("rowIndex" in value) || typeof value.rowIndex !== "number") {
    return false
  }
  return true
}
