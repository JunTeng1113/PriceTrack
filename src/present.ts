import { usedBoxes, type UsedBox, type UsedPost } from "./used-post.ts"

export type QuoteSource = "估價頁" | "快照"

export type Snapshot = {
  capturedAt: string
  html: string
  source?: QuoteSource
}

type StoredQuote = {
  code: string
  date: string
  sellingPrice: number
  group: string
  rowText: string
  capturedAt: string
  rowIndex: number
  source: QuoteSource
}

export type PriceSeries = {
  quotes: readonly StoredQuote[]
}

export type View = {
  queryRange: { start: string; end: string } | null
  chipGroups: readonly string[]
  candidates: readonly string[]
  listings: readonly { code: string; date: string; sellingPrice: number }[]
  selected: readonly string[]
  series: readonly {
    code: string
    colorIndex?: number
    quotes: readonly { date: string; sellingPrice: number; dashed?: boolean; delisted?: boolean }[]
  }[]
  axis: { lower: number; upper: number } | null
  readout: { date: string; code: string; sellingPrice: number } | null
  generation: Generation
  modelCharts: readonly {
    group: string
    selectedBrands: readonly string[]
    focus: string
    brands: readonly string[]
    legend: readonly string[]
    series: readonly {
      code: string
      colorIndex: number
      quotes: readonly { date: string; sellingPrice: number; dashed?: boolean; delisted?: boolean }[]
    }[]
    allSeries: readonly {
      code: string
      brand: string
      quotes: readonly { date: string; sellingPrice: number; dashed?: boolean; delisted?: boolean }[]
    }[]
    readout: { date: string; code: string; sellingPrice: number } | null
    used: readonly UsedBox[]
  }[]
}

export type Generation = "30" | "40" | "50"

export type Action =
  | { type: "setKeyword"; text: string }
  | { type: "select"; code: string }
  | { type: "deselect"; code: string }
  | { type: "setRange"; start: string; end: string }
  | { type: "setChipGroup"; name: string }
  | { type: "setGeneration"; name: Generation }
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
      const group = chipModelName(row.group)
      if (group === null) {
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
        group,
        rowText: row.text,
        capturedAt: snapshot.capturedAt,
        rowIndex,
        source: snapshot.source ?? "快照",
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
  if (order > 0) {
    return false
  }
  const previousInstall = isInstallPrice(previous.rowText)
  const nextInstall = isInstallPrice(next.rowText)
  if (previousInstall !== nextInstall) {
    return previousInstall
  }
  return next.sellingPrice < previous.sellingPrice
}

function isInstallPrice(rowText: string): boolean {
  return rowText.includes("裝機價") || rowText.includes("限搭機") || rowText.includes("組裝價")
}

type QuoteMark = { date: string; sellingPrice: number; dashed?: boolean; delisted?: boolean }

function quoteMark(quote: { date: string; sellingPrice: number; rowText: string }): QuoteMark {
  if (!isInstallPrice(quote.rowText) && !quote.rowText.includes("售罄")) {
    return { date: quote.date, sellingPrice: quote.sellingPrice }
  }
  return { date: quote.date, sellingPrice: quote.sellingPrice, dashed: true }
}

function quotesByCode(quotes: readonly StoredQuote[]): Map<string, StoredQuote[]> {
  const grouped = new Map<string, StoredQuote[]>()
  for (const quote of quotes) {
    const list = grouped.get(quote.code)
    if (list === undefined) {
      grouped.set(quote.code, [quote])
      continue
    }
    list.push(quote)
  }
  for (const list of grouped.values()) {
    list.sort((left, right) => left.date.localeCompare(right.date))
  }
  return grouped
}

function snapshotDates(quotes: readonly StoredQuote[]): string[] {
  const dates = new Set<string>()
  for (const quote of quotes) {
    const date = taipeiDate(quote.capturedAt)
    if (date !== "") {
      dates.add(date)
    }
  }
  return [...dates].sort()
}

function datesBetween(dates: readonly string[], after: string, before: string): string[] {
  let low = 0
  let high = dates.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if ((dates[mid] ?? "") <= after) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  const found: string[] = []
  for (let index = low; index < dates.length; index += 1) {
    const date = dates[index]
    if (date === undefined || date >= before) {
      break
    }
    found.push(date)
  }
  return found
}

function lineQuotes(
  own: readonly StoredQuote[],
  dates: readonly string[],
  range: { start: string; end: string } | null,
): QuoteMark[] {
  const marks: QuoteMark[] = []
  for (let index = 0; index < own.length; index += 1) {
    const quote = own[index]
    if (quote === undefined) {
      continue
    }
    if (quoteInRange(quote.date, range)) {
      marks.push(quoteMark(quote))
    }
    const next = own[index + 1]
    if (next === undefined) {
      continue
    }
    for (const day of datesBetween(dates, quote.date, next.date)) {
      if (quoteInRange(day, range)) {
        marks.push({ date: day, sellingPrice: quote.sellingPrice, dashed: true, delisted: true })
      }
    }
  }
  return marks
}

function chipModelName(group: string): string | null {
  if (group === "") {
    return ""
  }
  if (group.includes("轉接盒")) {
    return null
  }
  if (group.startsWith("微星 RX6600XT")) {
    return "AMD RX6600XT"
  }
  if (group === "AMD 專業級/工作站級 顯卡") {
    return "AMD Radeon AI PRO R9700"
  }
  let name = group.trim()
  name = name.replace(/\s*\[[^\]]*\]\s*$/g, "")
  name = name.replace(/\s*\([^)]*開賣\)\s*$/g, "")
  name = name.replace(/-\d{1,2}\/\d{1,2}.*開賣\s*$/g, "")
  name = name.replace(/\s+\d{1,2}\/\d{1,2}.*開賣\s*$/g, "")
  name = name.replace(/\s+年節期間現貨\+預定皆已完售！\s*$/g, "")
  name = name.replace(/\s+零星到貨! 隨時開放\s*$/g, "")
  name = name.replace(/\s+解禁\d{1,2}\/\d{1,2}.*$/g, "")
  name = name.replace(/\s+首批公版卡\s*$/g, "")
  name = name.replace(/\s+\(無類比輸出\)\s*$/g, "")
  name = name.replace(/\s+\(歡迎議價\)\s*$/g, "")
  name = name.replace(/\s+\(客訂交貨\.歡迎議價\)\s*$/g, "")
  name = name.replace(/\s+專業級顯示卡\s*$/g, "")
  name = name.replace(/\s+顯示卡\s*$/g, "")
  name = name.replace(/\s+系列\s*$/g, "")
  const trimmed = name.trim()
  if (trimmed === "") {
    return null
  }
  return sameCapacitySpelling(trimmed)
}

function sameCapacitySpelling(name: string): string {
  const withUnit = name.replace(/(\d+)G(?!B)/gi, "$1GB")
  const unwrapped = withUnit.replace(/\((\d+GB)\)/gi, "-$1")
  const ti = unwrapped.replace(/TI(?=-)/g, "Ti")
  const spelled = ti.replace(/Ti\s+(\d+GB)\b/g, "Ti-$1")
  if (spelled === "NVIDIA RTX5090-16GB(GDDR7)") {
    return "NVIDIA RTX5090-32GB(GDDR7)"
  }
  if (spelled === "NVIDIA RTX3060TI" || spelled === "NVIDIA RTX3060Ti-8GB") {
    return "NVIDIA RTX3060Ti-8GB(GDDR6)"
  }
  return spelled
}

export function visibleCodes(series: PriceSeries): string[] {
  const codes: string[] = []
  for (const quote of normalizeQuotes(series.quotes)) {
    if (!codes.includes(quote.code)) {
      codes.push(quote.code)
    }
  }
  return codes
}

function normalizeQuotes(quotes: readonly StoredQuote[]): StoredQuote[] {
  const byKey = new Map<string, StoredQuote>()
  const order: string[] = []
  for (const quote of quotes) {
    const code = promotionFree(quote.code)
    if (code === null || comboPrice(quote.rowText, code) || notGraphicsCard(code)) {
      continue
    }
    const named = chipModelName(quote.group)
    if (named === null) {
      continue
    }
    const group = named === "NVIDIA RTX3060Ti-8GB(GDDR6X)" && !/GDDR6X|D6X/i.test(code)
      ? "NVIDIA RTX3060Ti-8GB(GDDR6)"
      : named
    const next = code === quote.code && group === quote.group ? quote : { ...quote, code, group }
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

export function present(series: PriceSeries, actions: readonly Action[], usedPosts: readonly UsedPost[] = []): View {
  const stored = normalizeQuotes(series.quotes)
  let keyword = ""
  let generation: Generation = "50"
  const chosenGroups: string[] = []
  const brandsByGroup = new Map<string, string[]>()
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
      if (action.name !== "" && !chosenGroups.includes(action.name)) {
        chosenGroups.push(action.name)
      }
      continue
    }
    if (action.type === "setGeneration") {
      generation = action.name
      continue
    }
    if (action.type === "setBrand") {
      const chosen = action.name === "" ? [] : brandsByGroup.get(action.group) ?? []
      if (action.name !== "" && !chosen.includes(action.name)) {
        chosen.push(action.name)
      }
      brandsByGroup.set(action.group, chosen)
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
  const byCode = quotesByCode(stored)
  const dates = snapshotDates(stored)
  const chipGroups = chipGroupsInOrder(stored)
  const pool = uniqueCodes(visibleQuotes).filter((code) =>
    chosenGroups.length === 0 || visibleQuotes.some((quote) => quote.code === code && chosenGroups.includes(quote.group)),
  )
  const candidates = keyword === "" && chosenGroups.length === 0
    ? []
    : pool
      .filter((code) => keyword === "" || matchesKeyword(code, latestRowText(visibleQuotes, code), keyword))
      .sort(compareCodePoints)
  const listings = candidates.flatMap((code) => {
    const nearest = latestQuote(visibleQuotes, code)
    return nearest === null ? [] : [{ code, date: nearest.date, sellingPrice: nearest.sellingPrice }]
  })
  const plotted = selected.map((code) => ({
    code,
    quotes: lineQuotes(byCode.get(code) ?? [], dates, queryRange),
  }))
  const shownGroups = chosenGroups.length === 0
    ? chipGroups.filter((group) => isRtxGeneration(group, generation))
    : chipGroups.filter((group) => chosenGroups.includes(group))
  const modelCharts = shownGroups.map((group) => {
    const selectedBrands = brandsByGroup.get(group) ?? []
    const focus = focusByGroup.get(group) ?? ""
    const allSeries = uniqueCodes(stored.filter((quote) => quote.group === group)).flatMap((code) => {
      const quotes = lineQuotes(byCode.get(code) ?? [], dates, queryRange)
      if (quotes.length === 0) {
        return []
      }
      return [{ code, brand: brandOf(code), quotes }]
    })
    const groupCodes = allSeries.map((line) => line.code)
    const branded = allSeries.filter((line) => selectedBrands.length === 0 || selectedBrands.includes(brandGroup(line.brand)))
    const activeFocus = branded.some((line) => line.code === focus) ? focus : ""
    const lines = branded.map((line, index) => ({
      code: line.code,
      colorIndex: index,
      quotes: line.quotes,
    }))
    return {
      group,
      selectedBrands,
      focus: activeFocus,
      brands: brandsInOrder(groupCodes),
      legend: branded.map((line) => line.code),
      series: lines,
      allSeries,
      readout: readoutFor(lines, pointer),
      used: usedBoxes(usedPosts.map(recordedCode), groupCodes, queryRange),
    }
  })

  return {
    queryRange,
    chipGroups,
    candidates,
    listings,
    selected,
    series: plotted,
    axis: priceAxis(plotted),
    readout: readoutFor(plotted, pointer),
    generation,
    modelCharts,
  }
}

function recordedCode(post: UsedPost): UsedPost {
  const code = promotionFree(post.code)
  if (code === null || code === post.code) {
    return post
  }
  return { ...post, code }
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

function comboPrice(rowText: string, code: string): boolean {
  if (
    rowText.includes("組合")
    || rowText.includes("合購")
    || rowText.includes("加價購")
    || rowText.includes("加購")
    || rowText.includes("+購")
  ) {
    return true
  }
  return code.replaceAll("NITRO+", "").includes("+")
}

function notGraphicsCard(code: string): boolean {
  return code.includes("買")
    || code.includes("抽")
    || code.includes("延長線")
    || code.includes("Riser")
    || code.includes("轉接線")
}

function promotionFree(code: string): string | null {
  const trimmed = code.trim()
  if (trimmed.startsWith("&#x21AA;") || trimmed.startsWith("↪")) {
    return null
  }
  let rest = trimmed
  let previous = ""
  while (rest !== previous) {
    previous = rest
    rest = rest.replace(/&#x2764;/gi, "").replaceAll("❤", "").trim()
    while (rest.startsWith("[")) {
      const close = rest.indexOf("]")
      if (close < 0) {
        break
      }
      rest = rest.slice(close + 1).trim()
    }
    if (rest.startsWith("【")) {
      const close = rest.indexOf("】")
      if (close >= 0) {
        rest = rest.slice(close + 1).trim()
      }
    }
  }
  if (rest === "") {
    return null
  }
  if (rest.endsWith(" WHITE 白")) {
    rest = rest.slice(0, -2)
  }
  const shiniangLimited = "[萬圖師娘限量版]"
  if (rest.endsWith(shiniangLimited)) {
    return `${rest.slice(0, -shiniangLimited.length)}[萬圖師娘版]`
  }
  return rest
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
  if (quotes.length === 0) {
    return null
  }
  const end = taipeiToday()
  if (end === "") {
    return null
  }
  return { start: EARLIEST_DATE, end }
}

export function taipeiToday(): string {
  return taipeiDate(new Date().toISOString())
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

const BRAND_ORDER = ["華碩", "技嘉", "微星", "INNO3D", "ZOTAC"]
const BRAND_COLORS = ["#58c65b", "#5b58c6", "#c65b58", "#42bdbb", "#bb42bd", "#bdbb42"]
const OTHER_BRAND = "其他"

export function brandGroup(brand: string): string {
  if (BRAND_ORDER.includes(brand)) {
    return brand
  }
  return OTHER_BRAND
}

export function brandColorIndex(brand: string): number {
  const ranked = BRAND_ORDER.indexOf(brand)
  if (ranked >= 0) {
    return ranked
  }
  return BRAND_COLORS.length - 1
}

export function brandPaint(index: number): string {
  const last = BRAND_COLORS.length - 1
  const slot = index >= 0 && index <= last ? index : last
  return BRAND_COLORS[slot] ?? "#bdbb42"
}

export function brandColor(brand: string): string {
  return brandPaint(brandColorIndex(brand))
}

function brandsInOrder(codes: readonly string[]): string[] {
  const seen: string[] = []
  for (const code of codes) {
    const brand = brandGroup(brandOf(code))
    if (!seen.includes(brand)) {
      seen.push(brand)
    }
  }
  const ranked: string[] = []
  for (const name of BRAND_ORDER) {
    if (seen.includes(name)) {
      ranked.push(name)
    }
  }
  if (seen.includes(OTHER_BRAND)) {
    ranked.push(OTHER_BRAND)
  }
  return ranked
}

function latestQuote(quotes: readonly StoredQuote[], code: string): { date: string; sellingPrice: number } | null {
  let date = ""
  let sellingPrice = 0
  let found = false
  for (const quote of quotes) {
    if (quote.code !== code || (found && quote.date <= date)) {
      continue
    }
    date = quote.date
    sellingPrice = quote.sellingPrice
    found = true
  }
  return found ? { date, sellingPrice } : null
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

function isRtxGeneration(group: string, generation: Generation): boolean {
  return new RegExp(`RTX${generation}(?:50|60|70|80|90)`).test(group)
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
