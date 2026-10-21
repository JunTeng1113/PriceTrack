export type Snapshot = {
  capturedAt: string
  html: string
}

type StoredQuote = {
  code: string
  date: string
  sellingPrice: number
  group: string
  rowText: string
  capturedAt: string
  rowIndex: number
}

export type PriceSeries = {
  quotes: readonly StoredQuote[]
}

export type View = {
  queryRange: { start: string; end: string } | null
  chipGroups: readonly string[]
  candidates: readonly string[]
  selected: readonly string[]
  series: readonly {
    code: string
    colorIndex?: number
    quotes: readonly { date: string; sellingPrice: number }[]
  }[]
  axis: { lower: number; upper: number } | null
  readout: { date: string; code: string; sellingPrice: number } | null
  modelCharts: readonly {
    group: string
    brand: string
    focus: string
    brands: readonly string[]
    legend: readonly string[]
    series: readonly {
      code: string
      colorIndex: number
      quotes: readonly { date: string; sellingPrice: number }[]
    }[]
    readout: { date: string; code: string; sellingPrice: number } | null
  }[]
}

export type Action =
  | { type: "setKeyword"; text: string }
  | { type: "select"; code: string }
  | { type: "deselect"; code: string }
  | { type: "setRange"; start: string; end: string }
  | { type: "setChipGroup"; name: string }
  | { type: "setBrand"; group: string; name: string }
  | { type: "setFocus"; group: string; code: string }
  | { type: "point"; date: string; code: string }

const EARLIEST_DATE = "2020-01-01"
const VGA_LABEL = "顯示卡VGA"

export function emptySeries(): PriceSeries {
  return { quotes: [] }
}

export function update(series: PriceSeries, snapshots: readonly Snapshot[]): PriceSeries {
  const quotes = series.quotes.map((quote) => ({ ...quote }))
  const ordered = [...snapshots].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt))

  for (const snapshot of ordered) {
    const date = taipeiDate(snapshot.capturedAt)
    if (date === "" || date < EARLIEST_DATE) {
      continue
    }
    const selectHtml = vgaSelectHtml(snapshot.html)
    if (selectHtml === null) {
      continue
    }
    const rows = rowsInSelect(selectHtml)
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      if (row === undefined) {
        continue
      }
      if (row.group.includes("周邊") || row.group.includes("配件") || row.group.includes("支架")) {
        continue
      }
      const code = extractCode(row.text)
      const sellingPrice = parseSellingPrice(row.text)
      if (code === null || code.includes("支架") || code.includes("支撐架") || sellingPrice === null) {
        continue
      }
      const next: StoredQuote = {
        code,
        date,
        sellingPrice,
        group: row.group,
        rowText: row.text,
        capturedAt: snapshot.capturedAt,
        rowIndex,
      }
      const existing = quotes.findIndex((quote) => quote.code === code && quote.date === date)
      const previous = existing >= 0 ? quotes[existing] : undefined
      if (previous === undefined) {
        quotes.push(next)
      } else if (replacesDailyQuote(previous, next)) {
        quotes[existing] = next
      }
    }
  }

  return { quotes }
}

function replacesDailyQuote(previous: StoredQuote, next: StoredQuote): boolean {
  const order = previous.capturedAt.localeCompare(next.capturedAt)
  if (order < 0) {
    return true
  }
  return order === 0 && next.sellingPrice < previous.sellingPrice
}

function normalizeQuotes(quotes: readonly StoredQuote[]): StoredQuote[] {
  const byKey = new Map<string, StoredQuote>()
  const order: string[] = []
  for (const quote of quotes) {
    const code = promotionFree(quote.code)
    if (code === null) {
      continue
    }
    const next = code === quote.code ? quote : { ...quote, code }
    const key = `${next.code}\0${next.date}`
    const previous = byKey.get(key)
    if (previous === undefined) {
      byKey.set(key, next)
      order.push(key)
      continue
    }
    if (replacesDailyQuote(previous, next)) {
      byKey.set(key, next)
    }
  }
  const normalized: StoredQuote[] = []
  for (const key of order) {
    const quote = byKey.get(key)
    if (quote !== undefined) {
      normalized.push(quote)
    }
  }
  return normalized
}

export function present(series: PriceSeries, actions: readonly Action[]): View {
  const stored = normalizeQuotes(series.quotes)
  let keyword = ""
  let chipGroup = ""
  const brandByGroup = new Map<string, string>()
  const focusByGroup = new Map<string, string>()
  const selected: string[] = []
  let rangeOverride: { start: string; end: string } | null = null
  let pointer: { date: string; code: string } | null = null

  for (const action of actions) {
    if (action.type === "setKeyword") {
      keyword = action.text
      continue
    }
    if (action.type === "setChipGroup") {
      chipGroup = action.name
      continue
    }
    if (action.type === "setBrand") {
      brandByGroup.set(action.group, action.name)
      focusByGroup.delete(action.group)
      continue
    }
    if (action.type === "setFocus") {
      focusByGroup.set(action.group, action.code)
      continue
    }
    if (action.type === "setRange") {
      const start = action.start < EARLIEST_DATE ? EARLIEST_DATE : action.start
      rangeOverride = { start, end: action.end }
      continue
    }
    if (action.type === "deselect") {
      const index = selected.indexOf(action.code)
      if (index >= 0) {
        selected.splice(index, 1)
      }
      continue
    }
    if (action.type === "point") {
      pointer = { date: action.date, code: action.code }
      continue
    }
    const known = stored.some((quote) => quote.code === action.code)
    if (known && !selected.includes(action.code) && selected.length < 8) {
      selected.push(action.code)
    }
  }

  const queryRange = rangeOverride ?? queryRangeFor(stored)
  const visibleQuotes = stored.filter((quote) => quoteInRange(quote.date, queryRange))
  const chipGroups = chipGroupsInOrder(visibleQuotes)
  const pool = uniqueCodes(visibleQuotes).filter((code) =>
    chipGroup === "" || visibleQuotes.some((quote) => quote.code === code && quote.group === chipGroup),
  )
  const candidates = keyword === "" && chipGroup === ""
    ? []
    : pool
      .filter((code) => keyword === "" || matchesKeyword(code, latestRowText(visibleQuotes, code), keyword))
      .sort(compareCodePoints)
  const plotted = selected.map((code) => ({
    code,
    quotes: visibleQuotes
      .filter((quote) => quote.code === code)
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((quote) => ({ date: quote.date, sellingPrice: quote.sellingPrice })),
  }))
  const shownGroups = chipGroup === "" ? chipGroups : chipGroups.filter((group) => group === chipGroup)
  const modelCharts = shownGroups.map((group) => {
    const groupCodes = uniqueCodes(visibleQuotes.filter((quote) => quote.group === group))
    const brand = brandByGroup.get(group) ?? ""
    const focus = focusByGroup.get(group) ?? ""
    const branded = groupCodes.filter((code) => brand === "" || brandOf(code) === brand)
    const activeFocus = branded.includes(focus) ? focus : ""
    const lines = branded.map((code) => ({
      code,
      colorIndex: Math.max(0, branded.indexOf(code)),
      quotes: visibleQuotes
        .filter((quote) => quote.code === code)
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((quote) => ({ date: quote.date, sellingPrice: quote.sellingPrice })),
    }))
    return {
      group,
      brand,
      focus: activeFocus,
      brands: brandsInOrder(groupCodes),
      legend: branded,
      series: lines,
      readout: readoutFor(lines, pointer),
    }
  })

  return {
    queryRange,
    chipGroups,
    candidates,
    selected,
    series: plotted,
    axis: priceAxis(plotted),
    readout: readoutFor(plotted, pointer),
    modelCharts,
  }
}

function readoutFor(
  series: readonly { code: string; quotes: readonly { date: string; sellingPrice: number }[] }[],
  pointer: { date: string; code: string } | null,
): { date: string; code: string; sellingPrice: number } | null {
  if (pointer === null) {
    return null
  }
  const target = dayNumber(pointer.date)
  const item = series.find((entry) => entry.code === pointer.code)
  if (target === null || item === undefined) {
    return null
  }
  let nearest: { date: string; sellingPrice: number } | null = null
  let best: number | null = null
  for (const quote of item.quotes) {
    const day = dayNumber(quote.date)
    if (day === null) {
      continue
    }
    const distance = Math.abs(day - target)
    if (best === null || distance < best) {
      best = distance
      nearest = quote
    }
  }
  if (nearest === null) {
    return null
  }
  return { date: nearest.date, code: item.code, sellingPrice: nearest.sellingPrice }
}

function dayNumber(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return Math.floor(date.getTime() / 86400000)
}

function priceAxis(
  series: readonly { quotes: readonly { sellingPrice: number }[] }[],
): { lower: number; upper: number } | null {
  let min: number | null = null
  let max: number | null = null
  for (const item of series) {
    for (const quote of item.quotes) {
      if (min === null || quote.sellingPrice < min) {
        min = quote.sellingPrice
      }
      if (max === null || quote.sellingPrice > max) {
        max = quote.sellingPrice
      }
    }
  }
  if (min === null || max === null) {
    return null
  }
  return steppedPriceBounds(min, max)
}

export function steppedPriceBounds(min: number, max: number): { lower: number; upper: number } {
  return { lower: min * 0.95, upper: max * 1.05 }
}

function taipeiDate(capturedAt: string): string {
  const parsed = new Date(capturedAt)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed)
}

function vgaSelectHtml(html: string): string | null {
  const labelAt = html.indexOf(VGA_LABEL)
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

function extractCode(text: string): string | null {
  const open = text.indexOf("｛")
  if (open < 0) {
    const paren = text.indexOf("(")
    if (paren <= 0) {
      return null
    }
    const code = text.slice(0, paren).trim()
    return promotionFree(code)
  }
  const close = text.indexOf("｝", open + 1)
  if (close >= 0) {
    const code = text.slice(open + 1, close).trim()
    return promotionFree(code)
  }
  const paren = text.indexOf("(", open + 1)
  if (paren < 0) {
    return null
  }
  const code = text.slice(open + 1, paren).trim()
  return promotionFree(code)
}

function promotionFree(code: string): string | null {
  const trimmed = code.trim()
  if (trimmed.startsWith("&#x21AA;") || trimmed.startsWith("↪")) {
    return null
  }
  let rest = trimmed
  while (rest.startsWith("[")) {
    const close = rest.indexOf("]")
    if (close < 0) {
      break
    }
    rest = rest.slice(close + 1).trim()
  }
  return rest === "" ? null : rest
}

function parseSellingPrice(text: string): number | null {
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

function queryRangeFor(quotes: readonly StoredQuote[]): { start: string; end: string } | null {
  const dates = quotes.map((quote) => quote.date).sort()
  const end = dates.at(-1)
  if (end === undefined) {
    return null
  }
  const shifted = shiftMonths(end, -12)
  const start = shifted < EARLIEST_DATE ? EARLIEST_DATE : shifted
  return { start, end }
}

function shiftMonths(isoDate: string, months: number): string {
  const [yearText, monthText, dayText] = isoDate.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const monthIndex = month - 1 + months
  const nextYear = year + Math.floor(monthIndex / 12)
  const nextMonthIndex = ((monthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(nextYear, nextMonthIndex + 1, 0)).getUTCDate()
  const nextDay = Math.min(day, lastDay)
  return [
    String(nextYear).padStart(4, "0"),
    String(nextMonthIndex + 1).padStart(2, "0"),
    String(nextDay).padStart(2, "0"),
  ].join("-")
}

function quoteInRange(date: string, range: { start: string; end: string } | null): boolean {
  if (range === null) {
    return false
  }
  return date >= range.start && date <= range.end
}

function brandOf(code: string): string {
  if (code.startsWith("ROG-")) {
    return "華碩"
  }
  const space = code.indexOf(" ")
  if (space <= 0) {
    return code
  }
  return code.slice(0, space)
}

function brandsInOrder(codes: readonly string[]): string[] {
  const brands: string[] = []
  for (const code of codes) {
    const brand = brandOf(code)
    if (!brands.includes(brand)) {
      brands.push(brand)
    }
  }
  return brands
}

function uniqueCodes(quotes: readonly StoredQuote[]): string[] {
  const codes: string[] = []
  for (const quote of quotes) {
    if (!codes.includes(quote.code)) {
      codes.push(quote.code)
    }
  }
  return codes
}

function latestRowText(quotes: readonly StoredQuote[], code: string): string {
  const rows = quotes.filter((quote) => quote.code === code)
  const latest = rows.at(-1)
  return latest === undefined ? "" : latest.rowText
}

function matchesKeyword(code: string, rowText: string, keyword: string): boolean {
  const needle = keyword.toLowerCase()
  return code.toLowerCase().includes(needle) || rowText.toLowerCase().includes(needle)
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left)
  const rightPoints = Array.from(right)
  const count = Math.min(leftPoints.length, rightPoints.length)
  for (let index = 0; index < count; index += 1) {
    const leftPoint = leftPoints[index]?.codePointAt(0) ?? 0
    const rightPoint = rightPoints[index]?.codePointAt(0) ?? 0
    if (leftPoint !== rightPoint) {
      return leftPoint < rightPoint ? -1 : 1
    }
  }
  if (leftPoints.length === rightPoints.length) {
    return 0
  }
  return leftPoints.length < rightPoints.length ? -1 : 1
}

function chipGroupsInOrder(quotes: readonly StoredQuote[]): string[] {
  let latestCapturedAt = ""
  for (const quote of quotes) {
    if (quote.capturedAt > latestCapturedAt) {
      latestCapturedAt = quote.capturedAt
    }
  }
  const leading: string[] = []
  const latestRows = quotes
    .filter((quote) => quote.capturedAt === latestCapturedAt && quote.group !== "")
    .sort((left, right) => left.rowIndex - right.rowIndex)
  for (const quote of latestRows) {
    if (!leading.includes(quote.group)) {
      leading.push(quote.group)
    }
  }
  const trailing: string[] = []
  for (const quote of quotes) {
    if (quote.group === "" || leading.includes(quote.group) || trailing.includes(quote.group)) {
      continue
    }
    trailing.push(quote.group)
  }
  trailing.sort(compareCodePoints)
  return [...leading, ...trailing]
}
