import { update, type PriceSeries, type Snapshot } from "./present.ts"
import { formatCnsTaipei, taipeiDate, taipeiWallClock } from "./taipei-time.ts"

const memoryLabel = "記憶體 RAM"

const pageUrl = "https://www.coolpc.com.tw/evaluate.php"
const checkIntervalMs = 6 * 60 * 60 * 1000

export type PreparedSeries = {
  quotes: PriceSeries["quotes"]
  done: string[]
}

export type IngestStatus =
  | { status: "not-vga" }
  | { status: "no-stamp" }
  | { status: "already"; capturedAt: string }
  | { status: "saved"; capturedAt: string; quotes: number }

export function coolpcPageUrl(): string {
  return pageUrl
}

export function nextCheck(after: Date): Date {
  return new Date(after.getTime() + checkIntervalMs)
}

export function siteCapturedAt(html: string): string | null {
  const stamp = /(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?!:)\s*<span[^>]*>&#xe1db;/i.exec(html)
  if (stamp === null) {
    return null
  }
  const year = Number(stamp[1])
  const month = Number(stamp[2])
  const day = Number(stamp[3])
  const hour = Number(stamp[4])
  const minute = Number(stamp[5])
  const clock = taipeiWallClock(year, month, day, hour, minute, 0)
  if (clock === null) {
    return null
  }
  const capturedAt = formatCnsTaipei(clock)
  return capturedAt === "" ? null : capturedAt
}

export function ingestCoolpc(prepared: PreparedSeries, html: string): { prepared: PreparedSeries; result: IngestStatus } {
  if (!html.includes("顯示卡VGA")) {
    return { prepared, result: { status: "not-vga" } }
  }
  const capturedAt = siteCapturedAt(html)
  if (capturedAt === null) {
    return { prepared, result: { status: "no-stamp" } }
  }
  if (prepared.done.includes(capturedAt)) {
    return { prepared, result: { status: "already", capturedAt } }
  }
  const snapshot: Snapshot = { capturedAt, html, source: "估價頁" }
  const series = update({ quotes: prepared.quotes }, [snapshot])
  return {
    prepared: { quotes: series.quotes, done: [...prepared.done, capturedAt] },
    result: { status: "saved", capturedAt, quotes: series.quotes.length },
  }
}

type ComparedQuote = {
  code: string
  sellingPrice: number
  rowText: string
}

export type MemoryIngest =
  | { status: "no-menu"; prepared: PreparedSeries }
  | { status: "already"; prepared: PreparedSeries; capturedAt: string }
  | { status: "saved"; prepared: PreparedSeries; capturedAt: string; quotes: number }

export function ingestMemory(prepared: PreparedSeries, html: string, capturedAt: string): MemoryIngest {
  if (prepared.done.includes(capturedAt)) {
    return { status: "already", prepared, capturedAt }
  }
  const selectHtml = memorySelectHtml(html)
  if (selectHtml === null) {
    return { status: "no-menu", prepared }
  }
  const date = taipeiDay(capturedAt)
  const quotes = prepared.quotes.map((quote) => ({ ...quote }))
  if (date !== null) {
    const rows = rowsInSelect(selectHtml)
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      if (row === undefined) {
        continue
      }
      const code = memoryCode(row.text)
      const sellingPrice = sellingPriceOf(row.text)
      if (code === null || sellingPrice === null) {
        continue
      }
      remember(quotes, {
        code,
        date,
        sellingPrice,
        group: row.group,
        rowText: row.text,
        capturedAt,
        rowIndex,
        source: "估價頁",
      })
    }
  }
  return {
    status: "saved",
    prepared: { quotes, done: [...prepared.done, capturedAt] },
    capturedAt,
    quotes: quotes.length,
  }
}

export function changesAgainstPrevious(
  before: PreparedSeries,
  after: PreparedSeries,
  capturedAt: string,
): { previousAt: string | null; lines: string[] } {
  const previousAt = before.done.filter((item) => item < capturedAt).sort().at(-1) ?? null
  if (previousAt === null) {
    return { previousAt: null, lines: [] }
  }
  const previous = before.quotes.filter((quote) => quote.capturedAt === previousAt)
  const next = after.quotes.filter((quote) => quote.capturedAt === capturedAt)
  return { previousAt, lines: describeChanges(previous, next) }
}

function describeChanges(previous: readonly ComparedQuote[], next: readonly ComparedQuote[]): string[] {
  const before = byCode(previous)
  const after = byCode(next)
  const codes = [...new Set([...before.keys(), ...after.keys()])].sort((left, right) => left.localeCompare(right, "zh-Hant"))
  const priced: string[] = []
  const status: string[] = []
  const added: string[] = []
  const removed: string[] = []
  for (const code of codes) {
    const oldQuote = before.get(code)
    const newQuote = after.get(code)
    if (oldQuote === undefined && newQuote !== undefined) {
      added.push(`新增 ${code} ${quoteText(newQuote)}`)
      continue
    }
    if (oldQuote !== undefined && newQuote === undefined) {
      removed.push(`移除 ${code} ${quoteText(oldQuote)}`)
      continue
    }
    if (oldQuote === undefined || newQuote === undefined || sameQuote(oldQuote, newQuote)) {
      continue
    }
    const price = oldQuote.sellingPrice === newQuote.sellingPrice ? "" : ` ${money(oldQuote.sellingPrice)} → ${money(newQuote.sellingPrice)}`
    const changedStatus = quoteStatus(oldQuote.rowText) === quoteStatus(newQuote.rowText) ? "" : ` ${quoteStatus(oldQuote.rowText)} → ${quoteStatus(newQuote.rowText)}`
    const line = `${price === "" ? "狀態" : "售價"} ${code}${price}${changedStatus}`
    if (price === "") {
      status.push(line)
    } else {
      priced.push(line)
    }
  }
  return [...priced, ...status, ...added, ...removed]
}

function byCode(quotes: readonly ComparedQuote[]): Map<string, ComparedQuote> {
  const indexed = new Map<string, ComparedQuote>()
  for (const quote of quotes) {
    indexed.set(quote.code, quote)
  }
  return indexed
}

function sameQuote(left: ComparedQuote, right: ComparedQuote): boolean {
  return left.sellingPrice === right.sellingPrice && quoteStatus(left.rowText) === quoteStatus(right.rowText)
}

function quoteText(quote: ComparedQuote): string {
  const status = quoteStatus(quote.rowText)
  return status === "一般" ? money(quote.sellingPrice) : `${money(quote.sellingPrice)} ${status}`
}

function quoteStatus(rowText: string): string {
  if (rowText.includes("售罄")) {
    return "售罄"
  }
  if (rowText.includes("裝機價") || rowText.includes("限搭機") || rowText.includes("組裝價") || rowText.includes("搭機價")) {
    return "裝機價"
  }
  return "一般"
}

function taipeiDay(capturedAt: string): string | null {
  const date = taipeiDate(capturedAt)
  return date === "" ? null : date
}

function memorySelectHtml(html: string): string | null {
  const labelAt = html.indexOf(memoryLabel)
  if (labelAt < 0) {
    return null
  }
  const lower = html.toLowerCase()
  const selectAt = lower.indexOf("<select", labelAt)
  if (selectAt < 0) {
    return null
  }
  const endAt = lower.indexOf("</select>", selectAt)
  if (endAt < 0) {
    return null
  }
  return html.slice(selectAt, endAt + "</select>".length)
}

function rowsInSelect(selectHtml: string): { text: string; group: string }[] {
  const rows: { text: string; group: string }[] = []
  let group = ""
  const pattern = /<optgroup\b([^>]*)>|<\/optgroup>|<option\b[^>]*>([^<]*)/gi
  for (const match of selectHtml.matchAll(pattern)) {
    const tag = match[0]
    if (tag.toLowerCase().startsWith("</optgroup")) {
      group = ""
      continue
    }
    if (tag.toLowerCase().startsWith("<optgroup")) {
      const label = /label=["']([^"']*)["']/i.exec(match[1] ?? "")
      group = label === null ? "" : (label[1] ?? "")
      continue
    }
    const text = (match[2] ?? "").replace(/\s+/g, " ").trim()
    if (text.length > 0) {
      rows.push({ text, group })
    }
  }
  return rows
}

function memoryCode(text: string): string | null {
  const commaAt = text.search(/[,，]\s*\$/)
  if (commaAt < 0) {
    return null
  }
  const stripped = text.slice(0, commaAt).replace(/~(?:組裝價|搭機價|限搭機)~/g, " ").replace(/[｛｝]/g, " ")
  const code = stripped.replace(/\s+/g, " ").trim()
  if (code === "") {
    return null
  }
  return code
}

function sellingPriceOf(text: string): number | null {
  const arrow = text.indexOf("↘")
  const region = arrow >= 0 ? text.slice(arrow + 1) : text
  const amounts = [...region.matchAll(/\$([0-9,]+)/g)]
  const last = amounts.at(-1)
  if (last === undefined) {
    return null
  }
  const digits = (last[1] ?? "").replaceAll(",", "")
  if (!/^[0-9]+$/.test(digits)) {
    return null
  }
  return Number(digits)
}

function remember(quotes: PreparedSeries["quotes"][number][], next: PreparedSeries["quotes"][number]): void {
  const existing = quotes.findIndex((quote) => quote.code === next.code && quote.date === next.date)
  const previous = existing >= 0 ? quotes[existing] : undefined
  if (previous === undefined) {
    quotes.push(next)
    return
  }
  if (replacesMemoryQuote(previous, next)) {
    quotes[existing] = next
  }
}

function replacesMemoryQuote(previous: PreparedSeries["quotes"][number], next: PreparedSeries["quotes"][number]): boolean {
  const order = previous.capturedAt.localeCompare(next.capturedAt)
  if (order < 0) {
    return true
  }
  if (order > 0) {
    return false
  }
  const previousInstall = quoteStatus(previous.rowText) === "裝機價"
  const nextInstall = quoteStatus(next.rowText) === "裝機價"
  if (previousInstall !== nextInstall) {
    return previousInstall
  }
  return next.sellingPrice < previous.sellingPrice
}

function money(price: number): string {
  return `$${new Intl.NumberFormat("en-US").format(price)}`
}
