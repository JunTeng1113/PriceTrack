import type { PriceSeries } from "./present.ts"

export function isQuote(value: unknown): value is PriceSeries["quotes"][number] {
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
