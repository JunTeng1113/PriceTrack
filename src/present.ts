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
    quotes: readonly { date: string; sellingPrice: number }[]
  }[]
  axis: { lower: number; upper: number } | null
  readout: { date: string; code: string; sellingPrice: number } | null
}

export type Action =
  | { type: "setKeyword"; text: string }
  | { type: "select"; code: string }
  | { type: "setRange"; start: string; end: string }

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
    for (const row of rowsInSelect(selectHtml)) {
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

export function present(series: PriceSeries, actions: readonly Action[]): View {
  let keyword = ""
  const selected: string[] = []
  let rangeOverride: { start: string; end: string } | null = null

  for (const action of actions) {
    if (action.type === "setKeyword") {
      keyword = action.text
      continue
    }
    if (action.type === "setRange") {
      const start = action.start < EARLIEST_DATE ? EARLIEST_DATE : action.start
      rangeOverride = { start, end: action.end }
      continue
    }
    const known = series.quotes.some((quote) => quote.code === action.code)
    if (known && !selected.includes(action.code) && selected.length < 8) {
      selected.push(action.code)
    }
  }

  const queryRange = rangeOverride ?? queryRangeFor(series.quotes)
  const visibleQuotes = series.quotes.filter((quote) => quoteInRange(quote.date, queryRange))
  const candidates = keyword === ""
    ? []
    : uniqueCodes(visibleQuotes)
      .filter((code) => matchesKeyword(code, latestRowText(visibleQuotes, code), keyword))
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))

  return {
    queryRange,
    chipGroups: chipGroupsInOrder(visibleQuotes),
    candidates,
    selected,
    series: selected.map((code) => ({
      code,
      quotes: visibleQuotes
        .filter((quote) => quote.code === code)
        .sort((left, right) => left.date.localeCompare(right.date))
        .map((quote) => ({ date: quote.date, sellingPrice: quote.sellingPrice })),
    })),
    axis: null,
    readout: null,
  }
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
    return null
  }
  const close = text.indexOf("｝", open + 1)
  if (close >= 0) {
    const code = text.slice(open + 1, close).trim()
    return code === "" ? null : code
  }
  const paren = text.indexOf("(", open + 1)
  if (paren < 0) {
    return null
  }
  const code = text.slice(open + 1, paren).trim()
  return code === "" ? null : code
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

function chipGroupsInOrder(quotes: readonly StoredQuote[]): string[] {
  const groups: string[] = []
  for (const quote of quotes) {
    if (quote.group !== "" && !groups.includes(quote.group)) {
      groups.push(quote.group)
    }
  }
  return groups
}
