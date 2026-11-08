import { brandMarkup, buttonMarkup, chipGroupMarkup, chipVendorMarkup, generationMarkup, listingTableMarkup } from "./fields.tsx"
import { brandColorIndex, brandGroup, brandPaint, present, steppedPriceBounds, type Action, type PriceSeries, type View } from "./present.ts"
import type { UsedBox, UsedPost } from "./used-post.ts"

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replaceAll('"', "&quot;")
}

function addDays(isoDate: string, days: number): string {
  const [yearText, monthText, dayText] = isoDate.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return [
    String(shifted.getUTCFullYear()).padStart(4, "0"),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

function calendarDays(start: string, end: string): string[] {
  if (start > end) {
    return []
  }
  const days: string[] = []
  let cursor = start
  while (cursor <= end) {
    days.push(cursor)
    const next = addDays(cursor, 1)
    if (next <= cursor) {
      break
    }
    cursor = next
  }
  return days
}

function axisDates(view: View): string[] {
  const dates: string[] = []
  for (const item of view.series) {
    for (const quote of item.quotes) {
      if (!dates.includes(quote.date)) {
        dates.push(quote.date)
      }
    }
  }
  dates.sort()
  const start = dates[0]
  const end = dates.at(-1)
  if (start === undefined || end === undefined) {
    return []
  }
  return calendarDays(start, end)
}

function dayNumber(isoDate: string): number {
  const [yearText, monthText, dayText] = isoDate.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000)
}

function addMonths(isoDate: string, count: number): string {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) {
    return ""
  }
  const shifted = month - 1 + count
  const nextYear = year + Math.floor(shifted / 12)
  const nextMonth = ((shifted % 12) + 12) % 12
  const last = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate()
  const nextDay = Math.min(day, last)
  return [
    String(nextYear).padStart(4, "0"),
    String(nextMonth + 1).padStart(2, "0"),
    String(nextDay).padStart(2, "0"),
  ].join("-")
}

export type ChartRange = "fit" | "12" | "6" | "3"
export type IndicatorWindow = "month" | "quarter" | "hybrid"

const rangeMonths: Record<Exclude<ChartRange, "fit">, number> = {
  "12": 12,
  "6": 6,
  "3": 3,
}

function longerThanMonths(start: string, end: string, months: number): boolean {
  const limit = addMonths(start, months)
  return limit !== "" && end > limit
}

function windowScale(start: string, end: string, months: number): number | null {
  if (!longerThanMonths(start, end, months)) {
    return null
  }
  const windowDays = dayNumber(addMonths(start, months)) - dayNumber(start)
  const span = dayNumber(end) - dayNumber(start)
  if (windowDays <= 0 || span <= windowDays) {
    return null
  }
  return span / windowDays
}

function readChartRange(svg: SVGSVGElement): ChartRange {
  const value = svg.getAttribute("data-mode") ?? "fit"
  if (value === "12" || value === "6" || value === "3" || value === "fit") {
    return value
  }
  return "fit"
}

function spanOf(lines: readonly { quotes: readonly { date: string }[] }[]): { start: string; end: string } | null {
  let start = ""
  let end = ""
  for (const line of lines) {
    for (const quote of line.quotes) {
      if (start === "" || quote.date < start) {
        start = quote.date
      }
      if (quote.date > end) {
        end = quote.date
      }
    }
  }
  if (start === "" || end === "") {
    return null
  }
  return { start, end }
}

function seriesColor(index: number): string {
  return brandPaint(index)
}

const plotLeft = 4
const plotRight = 270
const priceAxisX = plotRight
const seriesNameX = priceAxisX + 24
const labelSize = 3.2
const labelGap = 3.6
const labelTop = 2
const labelBottom = 98
const plotTop = 4
const plotBottom = 84

function formatPrice(value: number): string {
  return formatSellingPrice(value)
}

function xAt(date: string, startDay: number, daySpan: number): number {
  if (daySpan === 0) {
    return (plotLeft + plotRight) / 2
  }
  return plotLeft + ((dayNumber(date) - startDay) / daySpan) * (plotRight - plotLeft)
}

function yAt(price: number, axis: { lower: number; upper: number }): number {
  const span = axis.upper - axis.lower
  if (span === 0) {
    return (plotTop + plotBottom) / 2
  }
  return plotTop + (1 - (price - axis.lower) / span) * (plotBottom - plotTop)
}

function monthLastDay(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function completeMonth(start: string, end: string, label: string): boolean {
  const year = Number(label.slice(0, 4))
  const month = Number(label.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return false
  }
  const first = `${label}-01`
  return start <= first && end >= monthLastDay(year, month)
}

function monthDayCount(start: string, end: string, label: string): number {
  const year = Number(label.slice(0, 4))
  const month = Number(label.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 0
  }
  const first = `${label}-01`
  const last = monthLastDay(year, month)
  const from = start > first ? start : first
  const to = end < last ? end : last
  if (from > to) {
    return 0
  }
  return dayNumber(to) - dayNumber(from) + 1
}

function monthTicks(start: string, end: string): { date: string; label: string }[] {
  const ticks: { date: string; label: string }[] = []
  let year = Number(start.slice(0, 4))
  let month = Number(start.slice(5, 7))
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return ticks
  }
  const endKey = end.slice(0, 7)
  while (ticks.length < 240) {
    const label = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`
    if (label > endKey) {
      break
    }
    const first = `${label}-01`
    const date = first < start ? start : first > end ? end : first
    ticks.push({ date, label })
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
  return ticks
}

function priceTicks(lower: number, upper: number): number[] {
  const intervals = 10
  if (upper <= lower) {
    return [lower]
  }
  const step = (upper - lower) / intervals
  const ticks: number[] = []
  for (let index = 0; index <= intervals; index += 1) {
    ticks.push(index === intervals ? upper : lower + step * index)
  }
  return ticks
}

function chartFrame(start: string, end: string, axis: { lower: number; upper: number }): string {
  const startDay = dayNumber(start)
  const daySpan = dayNumber(end) - startDay
  const months = monthTicks(start, end)
  const prices = priceTicks(axis.lower, axis.upper)
  const horizontal = prices.map((price) => {
    const y = yAt(price, axis)
    return `M${plotLeft} ${y} H${plotRight}`
  }).join(" ")
  const vertical = months.map((tick) => {
    const x = xAt(tick.date, startDay, daySpan)
    return `M${x} ${plotTop} V${plotBottom}`
  }).join(" ")
  const firstLabel = months[0]?.label ?? ""
  const lastLabel = months[months.length - 1]?.label ?? ""
  const firstDays = firstLabel === "" ? 0 : monthDayCount(start, end, firstLabel)
  const lastDays = lastLabel === "" ? 0 : monthDayCount(start, end, lastLabel)
  const xLabels = months.map((tick, index) => {
    if (index === 0 && !completeMonth(start, end, tick.label)) {
      return ""
    }
    if (index === 1 && firstDays < 14) {
      return ""
    }
    if (index === months.length - 1 && lastDays < 14) {
      return ""
    }
    const x = xAt(tick.date, startDay, daySpan)
    return `<text data-axis="x" x="${x}" y="96" font-size="3.2" fill="#334155" text-anchor="middle">${escapeHtml(tick.label)}</text>`
  }).join("")
  const yLabels = prices.map((price) =>
    `<text data-axis="y" x="${priceAxisX + 2}" y="${yAt(price, axis)}" font-size="3.2" fill="#334155" text-anchor="start" dominant-baseline="middle">${formatPrice(price)}</text>`,
  ).join("")
  return [
    `<rect data-axis="background" x="${plotLeft}" y="${plotTop}" width="${plotRight - plotLeft}" height="${plotBottom - plotTop}" fill="#e8eef7" pointer-events="none" />`,
    `<path data-axis="grid" d="${horizontal} ${vertical}" fill="none" stroke="#c5d0de" stroke-width="0.35" pointer-events="none" />`,
    `<path data-axis="x" d="M${plotLeft} ${plotBottom} H${plotRight}" fill="none" stroke="#334155" stroke-width="0.6" pointer-events="none" />`,
    `<path data-axis="y" d="M${priceAxisX} ${plotTop} V${plotBottom}" fill="none" stroke="#334155" stroke-width="0.6" pointer-events="none" />`,
    xLabels,
    yLabels,
  ].join("")
}

const preparedBrandSvgs = new Map<string, Map<string, string>>()

export function preparedBrandChart(group: string, brand: string): string | null {
  const charts = preparedBrandSvgs.get(group)
  if (charts === undefined) {
    return null
  }
  return charts.get(brand) ?? null
}

function labelStyle(count: number): { fontSize: number; gap: number } {
  if (count <= 1) {
    return { fontSize: labelSize, gap: labelGap }
  }
  const fitted = (labelBottom - labelTop) / (count - 1)
  if (fitted >= labelGap) {
    return { fontSize: labelSize, gap: labelGap }
  }
  return { fontSize: fitted * 0.9, gap: fitted }
}

function spreadLabelYs(preferred: readonly number[], gap: number): number[] {
  const count = preferred.length
  if (count === 0) {
    return []
  }
  const only = preferred[0] ?? labelTop
  if (count === 1) {
    return [Math.min(labelBottom, Math.max(labelTop, only))]
  }
  const order = preferred.map((y, index) => ({ y, index }))
  order.sort((left, right) => left.y - right.y || left.index - right.index)
  const placed: number[] = []
  let cursor = labelTop
  for (const item of order) {
    const next = Math.max(item.y, cursor)
    placed.push(next)
    cursor = next + gap
  }
  const last = placed[count - 1] ?? labelBottom
  if (last > labelBottom) {
    const shift = last - labelBottom
    for (let index = 0; index < placed.length; index += 1) {
      placed[index] = (placed[index] ?? labelBottom) - shift
    }
  }
  const first = placed[0] ?? labelTop
  if (first < labelTop) {
    cursor = labelTop
    for (let index = 0; index < placed.length; index += 1) {
      placed[index] = cursor
      cursor += gap
    }
  }
  const result = Array.from({ length: count }, () => labelTop)
  for (let index = 0; index < order.length; index += 1) {
    const item = order[index]
    const y = placed[index]
    if (item !== undefined && y !== undefined) {
      result[item.index] = y
    }
  }
  return result
}

function chartSvg(
  marks: string,
  label = "",
  chartAttribute = "data-price-chart",
  span: { start: string; end: string } | null = null,
): string {
  const named = label === "" ? "" : ` aria-label="${label}"`
  const dated = span === null ? "" : ` data-chart-start="${escapeAttribute(span.start)}" data-chart-end="${escapeAttribute(span.end)}" data-mode="fit"`
  const svg = `<svg ${chartAttribute}${named}${dated} viewBox="0 0 400 100" width="100%" style="display:block;width:100%;height:auto;aspect-ratio:4/1">${marks}</svg>`
  if (span === null || !longerThanMonths(span.start, span.end, 3)) {
    return svg
  }
  return `<div data-chart-width data-mode="fit"><div data-chart-window class="w-full max-w-full overflow-x-auto">${svg}</div></div>`
}

const plotSpan = plotRight - plotLeft
const axisGutter = 400 - plotRight

function mapX(x: number, scale: number): number {
  if (x <= plotRight) {
    return plotLeft + (x - plotLeft) * scale
  }
  return x + plotSpan * (scale - 1)
}

function unmapX(x: number, scale: number): number {
  const shifted = plotLeft + plotSpan * scale
  if (x <= shifted) {
    return plotLeft + (x - plotLeft) / scale
  }
  return x - plotSpan * (scale - 1)
}

function readNumber(element: Element, name: string): number | null {
  const text = element.getAttribute(name)
  if (text === null || text === "") {
    return null
  }
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function scalePath(path: string, map: (x: number) => number): string {
  const tokens = path.match(/[MLHVZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
  if (tokens === null) {
    return path
  }
  let command = ""
  let expectX = true
  const parts: string[] = []
  for (const token of tokens) {
    if (/^[MLHVZ]$/i.test(token)) {
      command = token.toUpperCase()
      expectX = true
      parts.push(token)
      continue
    }
    const value = Number(token)
    if (!Number.isFinite(value)) {
      parts.push(token)
      continue
    }
    if (command === "H" || ((command === "M" || command === "L") && expectX)) {
      parts.push(String(map(value)))
      expectX = command === "H"
      continue
    }
    parts.push(token)
    expectX = true
  }
  return parts.join(" ")
}

function isAxisPiece(node: Element): boolean {
  return node.getAttribute("data-axis") === "y" || node.getAttribute("data-series-label") === "true"
}

function scaleElement(element: Element, scale: number, toMonths: boolean): void {
  const scaled = element.getAttribute("data-x-scaled") === "true"
  if (toMonths === scaled) {
    return
  }
  const map = toMonths ? (value: number): number => mapX(value, scale) : (value: number): number => unmapX(value, scale)
  let changed = false
  for (const name of ["x", "x1", "x2", "cx"]) {
    const value = readNumber(element, name)
    if (value === null) {
      continue
    }
    element.setAttribute(name, String(map(value)))
    changed = true
  }
  const path = element.getAttribute("d")
  if (path !== null && path !== "") {
    element.setAttribute("d", scalePath(path, map))
    changed = true
  }
  if (element.getAttribute("data-axis") === "background") {
    const width = readNumber(element, "width")
    if (width !== null) {
      element.setAttribute("width", String(toMonths ? width * scale : width / scale))
      changed = true
    }
  }
  if (!changed) {
    return
  }
  if (toMonths) {
    element.setAttribute("data-x-scaled", "true")
    return
  }
  element.removeAttribute("data-x-scaled")
}

function scaleTree(root: Element, scale: number, toMonths: boolean): void {
  scaleElement(root, scale, toMonths)
  for (const node of root.querySelectorAll("*")) {
    scaleElement(node, scale, toMonths)
  }
}

function chartHost(svg: Element): Element | null {
  return svg.closest("[data-chart-width]")
}

function isSvgNode(node: Element | null): node is SVGSVGElement {
  return node !== null && node.tagName.toLowerCase() === "svg"
}

function axisSvg(host: Element): SVGSVGElement | null {
  const side = host.querySelector("svg[data-chart-axis]")
  return isSvgNode(side) ? side : null
}

function parkAxis(svg: SVGSVGElement, scale: number): void {
  const host = chartHost(svg)
  const windowEl = svg.closest("[data-chart-window]")
  if (host === null || windowEl === null) {
    return
  }
  let side = axisSvg(host)
  if (side === null) {
    const created = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg")
    if (!isSvgNode(created)) {
      return
    }
    side = created
    side.setAttribute("data-chart-axis", "")
    side.setAttribute("viewBox", `${plotRight} 0 ${axisGutter} 100`)
    side.setAttribute("style", "display:block;width:calc(130 / 400 * 100%);height:auto;aspect-ratio:130/100;flex:none")
  }
  const row = windowEl.parentElement?.getAttribute("data-chart-row") === ""
    ? windowEl.parentElement
    : svg.ownerDocument.createElement("div")
  if (row === null) {
    return
  }
  if (row.getAttribute("data-chart-row") !== "") {
    row.setAttribute("data-chart-row", "")
    row.setAttribute("class", "flex w-full items-start")
    windowEl.replaceWith(row)
    row.append(windowEl)
  }
  if (side.parentElement !== row) {
    row.append(side)
  }
  windowEl.setAttribute("class", "min-w-0 overflow-x-auto")
  windowEl.setAttribute("style", "width:calc(270 / 400 * 100%)")
  for (const node of [...svg.querySelectorAll("*")].filter((item) => isAxisPiece(item))) {
    scaleElement(node, scale, false)
    side.append(node)
  }
}

function restoreAxis(svg: SVGSVGElement): void {
  const host = chartHost(svg)
  if (host === null) {
    return
  }
  const side = axisSvg(host)
  if (side !== null) {
    while (side.firstChild !== null) {
      svg.append(side.firstChild)
    }
    side.remove()
  }
  const windowEl = host.querySelector("[data-chart-window]")
  const row = host.querySelector("[data-chart-row]")
  if (windowEl !== null) {
    windowEl.setAttribute("class", "w-full max-w-full overflow-x-auto")
    windowEl.removeAttribute("style")
    if (row !== null) {
      row.replaceWith(windowEl)
    }
  }
}

function showFit(svg: SVGSVGElement): void {
  svg.setAttribute("viewBox", "0 0 400 100")
  svg.setAttribute("width", "100%")
  svg.setAttribute("style", "display:block;width:100%;height:auto;aspect-ratio:4/1")
  svg.setAttribute("data-mode", "fit")
  chartHost(svg)?.setAttribute("data-mode", "fit")
}

function showWindow(svg: SVGSVGElement, mode: Exclude<ChartRange, "fit">, scale: number): void {
  scaleTree(svg, scale, true)
  parkAxis(svg, scale)
  const plotWidth = plotLeft + plotSpan * scale
  svg.setAttribute("viewBox", `0 0 ${plotWidth} 100`)
  svg.setAttribute("width", `${(plotWidth / 270) * 100}%`)
  svg.setAttribute("style", `display:block;width:${(plotWidth / 270) * 100}%;height:auto;aspect-ratio:${plotWidth}/100`)
  svg.setAttribute("data-mode", mode)
  chartHost(svg)?.setAttribute("data-mode", mode)
  const windowEl = svg.closest("[data-chart-window]")
  if (windowEl instanceof HTMLElement) {
    windowEl.scrollLeft = windowEl.scrollWidth
  }
}

function isoFromDayNumber(day: number): string {
  const date = new Date(day * 86400000)
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-")
}

function visibleStart(start: string, end: string, mode: ChartRange): string {
  if (mode === "fit" || start === "" || end === "") {
    return start
  }
  const limit = addMonths(start, rangeMonths[mode])
  if (limit === "" || end <= limit) {
    return start
  }
  const windowDays = dayNumber(limit) - dayNumber(start)
  if (windowDays <= 0) {
    return start
  }
  return isoFromDayNumber(dayNumber(end) - windowDays)
}

function inWindow(date: string, start: string, end: string): boolean {
  return date !== "" && date >= start && date <= end
}

function parseAxisPrice(text: string): number | null {
  const digits = text.replaceAll("$", "").replaceAll(",", "")
  if (!/^-?\d+(?:\.\d+)?$/.test(digits)) {
    return null
  }
  const value = Number(digits)
  return Number.isFinite(value) ? value : null
}

function fullPriceAxis(svg: SVGSVGElement): { lower: number; upper: number } | null {
  const storedLower = readNumber(svg, "data-full-lower")
  const storedUpper = readNumber(svg, "data-full-upper")
  if (storedLower !== null && storedUpper !== null && storedUpper > storedLower) {
    return { lower: storedLower, upper: storedUpper }
  }
  const prices: number[] = []
  for (const label of svg.querySelectorAll('text[data-axis="y"]')) {
    const price = parseAxisPrice(label.textContent ?? "")
    if (price !== null) {
      prices.push(price)
    }
  }
  prices.sort((left, right) => left - right)
  const lower = prices[0]
  const upper = prices.at(-1)
  if (lower === undefined || upper === undefined || upper <= lower) {
    return null
  }
  svg.setAttribute("data-full-lower", String(lower))
  svg.setAttribute("data-full-upper", String(upper))
  return { lower, upper }
}

function pricesInWindow(svg: SVGSVGElement, start: string, end: string): number[] {
  const prices: number[] = []
  const push = (value: number | null): void => {
    if (value !== null) {
      prices.push(value)
    }
  }
  for (const node of svg.querySelectorAll("[data-date]")) {
    const date = node.getAttribute("data-date") ?? ""
    if (!inWindow(date, start, end)) {
      continue
    }
    push(readNumber(node, "data-price"))
    push(readNumber(node, "data-low"))
    push(readNumber(node, "data-high"))
  }
  for (const node of svg.querySelectorAll("line[data-from-date]")) {
    const from = node.getAttribute("data-from-date") ?? ""
    const to = node.getAttribute("data-to-date") ?? ""
    if (inWindow(from, start, end)) {
      push(readNumber(node, "data-from-price"))
    }
    if (inWindow(to, start, end)) {
      push(readNumber(node, "data-to-price"))
    }
  }
  return prices
}

function retargetSellingBand(svg: SVGSVGElement, axis: { lower: number; upper: number }): void {
  const path = svg.querySelector("path[data-selling-band]")
  const lines = [...svg.querySelectorAll("line[data-selling-band]")]
  if (path === null || lines.length === 0) {
    return
  }
  const upper: string[] = []
  const lower: string[] = []
  for (const line of lines) {
    const x = line.getAttribute("x1") ?? ""
    const high = readNumber(line, "data-high")
    const low = readNumber(line, "data-low")
    if (x === "" || high === null || low === null) {
      continue
    }
    upper.push(`${x} ${yAt(high, axis).toFixed(2)}`)
    lower.push(`${x} ${yAt(low, axis).toFixed(2)}`)
  }
  const start = upper[0]
  if (start === undefined) {
    return
  }
  const forward = upper.slice(1).map((point) => `L${point}`).join("")
  const back = [...lower].reverse().map((point) => `L${point}`).join("")
  path.setAttribute("d", `M${start}${forward}${back}Z`)
}

function retargetAverage(svg: SVGSVGElement, axis: { lower: number; upper: number }): void {
  for (const window of ["month", "quarter", "hybrid"] as const) {
    retargetLine(svg.querySelector(`path[data-trend][data-window="${window}"]`), [...svg.querySelectorAll(`circle[data-average][data-window="${window}"]`)], axis)
    retargetLine(svg.querySelector(`path[data-percentile="50"][data-window="${window}"]`), [...svg.querySelectorAll(`circle[data-percentile="50"][data-window="${window}"]`)], axis)
    retargetLine(svg.querySelector(`path[data-percentile="25"][data-window="${window}"]`), [...svg.querySelectorAll(`circle[data-percentile="25"][data-window="${window}"]`)], axis)
    retargetSweetZone(svg, axis, window)
  }
}

function retargetSweetZone(svg: SVGSVGElement, axis: { lower: number; upper: number }, window: IndicatorWindow): void {
  const path = svg.querySelector(`path[data-sweet-zone][data-window="${window}"]`)
  const lines = [...svg.querySelectorAll(`line[data-sweet-zone][data-window="${window}"]`)]
  if (path === null || lines.length === 0) {
    return
  }
  const floor = plotBottom.toFixed(2)
  const commands: string[] = []
  let upper: string[] = []
  let lower: string[] = []
  let previous = ""
  const flush = (): void => {
    const start = upper[0]
    if (start === undefined) {
      return
    }
    const forward = upper.slice(1).map((point) => `L${point}`).join("")
    const back = [...lower].reverse().map((point) => `L${point}`).join("")
    commands.push(`M${start}${forward}${back}Z`)
    upper = []
    lower = []
  }
  for (const line of lines) {
    const price = readNumber(line, "data-price")
    const date = line.getAttribute("data-date") ?? ""
    const x = line.getAttribute("x1") ?? ""
    if (price === null || x === "") {
      continue
    }
    if (previous !== "" && addDays(previous, 1) !== date) {
      flush()
    }
    const y = yAt(price, axis).toFixed(2)
    line.setAttribute("y1", y)
    line.setAttribute("y2", floor)
    upper.push(`${x} ${y}`)
    lower.push(`${x} ${floor}`)
    previous = date
  }
  flush()
  if (commands.length > 0) {
    path.setAttribute("d", commands.join(""))
  }
}

function retargetLine(path: Element | null, circles: readonly Element[], axis: { lower: number; upper: number }): void {
  if (path === null || circles.length === 0) {
    return
  }
  let drawn = ""
  let previous = ""
  for (const circle of circles) {
    const price = readNumber(circle, "data-price")
    const date = circle.getAttribute("data-date") ?? ""
    const x = circle.getAttribute("cx") ?? ""
    if (price === null || x === "") {
      continue
    }
    const y = yAt(price, axis).toFixed(2)
    circle.setAttribute("cy", y)
    const command = previous !== "" && addDays(previous, 1) === date ? "L" : "M"
    drawn += `${command}${x} ${y}`
    previous = date
  }
  if (drawn !== "") {
    path.setAttribute("d", drawn)
  }
}

function retargetSeriesLabels(svg: SVGSVGElement): void {
  const labels = [...svg.querySelectorAll("text[data-series-label]")]
  if (labels.length === 0) {
    return
  }
  const circles = [...svg.querySelectorAll("circle[data-code][data-date]")]
  const preferred = labels.map((label) => {
    const code = label.getAttribute("data-code") ?? ""
    let y = Number(label.getAttribute("y"))
    for (const circle of circles) {
      if (circle.getAttribute("data-code") !== code) {
        continue
      }
      const next = readNumber(circle, "cy")
      if (next !== null) {
        y = next
      }
    }
    return Number.isFinite(y) ? y : labelTop
  })
  const placed = spreadLabelYs(preferred, labelStyle(labels.length).gap)
  for (const [index, label] of labels.entries()) {
    const y = placed[index]
    if (y !== undefined) {
      label.setAttribute("y", String(y))
    }
  }
}

function retargetPriceMarks(svg: SVGSVGElement, axis: { lower: number; upper: number }): void {
  for (const node of svg.querySelectorAll("circle[data-price]")) {
    const price = readNumber(node, "data-price")
    if (price === null) {
      continue
    }
    const y = String(yAt(price, axis))
    node.setAttribute("cy", y)
    const twin = node.nextElementSibling
    if (
      twin !== null
      && twin.tagName.toLowerCase() === "circle"
      && twin.getAttribute("data-price") === null
      && twin.getAttribute("data-date") === null
    ) {
      twin.setAttribute("cy", y)
    }
  }
  for (const node of svg.querySelectorAll("line[data-from-price]")) {
    const from = readNumber(node, "data-from-price")
    const to = readNumber(node, "data-to-price")
    if (from !== null) {
      node.setAttribute("y1", String(yAt(from, axis)))
    }
    if (to !== null) {
      node.setAttribute("y2", String(yAt(to, axis)))
    }
  }
  for (const node of svg.querySelectorAll("line[data-high]")) {
    const high = readNumber(node, "data-high")
    const low = readNumber(node, "data-low")
    if (high !== null) {
      node.setAttribute("y1", String(yAt(high, axis)))
    }
    if (low !== null) {
      node.setAttribute("y2", String(yAt(low, axis)))
    }
  }
  retargetSellingBand(svg, axis)
  retargetAverage(svg, axis)
  retargetSeriesLabels(svg)
}

function retargetPriceGrid(svg: SVGSVGElement, axis: { lower: number; upper: number }): void {
  const ticks = priceTicks(axis.lower, axis.upper)
  const grid = svg.querySelector('[data-axis="grid"]')
  if (grid !== null) {
    const path = grid.getAttribute("d") ?? ""
    const vertical = path.split(/(?=M)/i).filter((part) => /V/i.test(part)).join("").trim()
    const horizontal = ticks.map((price) => `M${plotLeft} ${yAt(price, axis)} H${plotRight}`).join(" ")
    grid.setAttribute("d", vertical === "" ? horizontal : `${horizontal} ${vertical}`)
  }
  const labels = [...svg.querySelectorAll('text[data-axis="y"]')]
  for (const [index, label] of labels.entries()) {
    const price = ticks[index]
    if (price === undefined) {
      continue
    }
    label.setAttribute("y", String(yAt(price, axis)))
    label.textContent = formatPrice(price)
  }
}

function applyVisiblePriceAxis(svg: SVGSVGElement, mode: ChartRange): void {
  const full = fullPriceAxis(svg)
  if (full === null) {
    return
  }
  const start = svg.getAttribute("data-chart-start") ?? ""
  const end = svg.getAttribute("data-chart-end") ?? ""
  let axis = full
  if (mode !== "fit") {
    const prices = pricesInWindow(svg, visibleStart(start, end, mode), end)
    const first = prices[0]
    if (first !== undefined) {
      let min = first
      let max = first
      for (const price of prices) {
        if (price < min) {
          min = price
        }
        if (price > max) {
          max = price
        }
      }
      axis = steppedPriceBounds(min, max)
    }
  }
  retargetPriceGrid(svg, axis)
  retargetPriceMarks(svg, axis)
}

export function applyChartMode(svg: SVGSVGElement, mode: ChartRange): void {
  const start = svg.getAttribute("data-chart-start") ?? ""
  const end = svg.getAttribute("data-chart-end") ?? ""
  const current = readChartRange(svg)
  if (current === mode) {
    return
  }
  if (current !== "fit") {
    const scale = windowScale(start, end, rangeMonths[current])
    if (scale !== null) {
      restoreAxis(svg)
      scaleTree(svg, scale, false)
    }
    showFit(svg)
  }
  if (mode !== "fit") {
    const scale = windowScale(start, end, rangeMonths[mode])
    if (scale !== null) {
      applyVisiblePriceAxis(svg, mode)
      showWindow(svg, mode, scale)
      return
    }
  }
  applyVisiblePriceAxis(svg, "fit")
}

export function adoptChartMark(svg: SVGSVGElement, node: Element): void {
  const mode = readChartRange(svg)
  if (mode === "fit") {
    return
  }
  const scale = windowScale(svg.getAttribute("data-chart-start") ?? "", svg.getAttribute("data-chart-end") ?? "", rangeMonths[mode])
  if (scale === null) {
    return
  }
  scaleTree(node, scale, true)
  const host = chartHost(svg)
  const side = host === null ? null : axisSvg(host)
  if (side === null) {
    return
  }
  const pieces = isAxisPiece(node) ? [node] : [...node.querySelectorAll("*")].filter((item) => isAxisPiece(item))
  for (const piece of pieces) {
    scaleElement(piece, scale, false)
    side.append(piece)
  }
}

function chartMarkList(view: View, connectGaps = false, focus = ""): string[] {
  const dates = axisDates(view)
  const start = dates[0]
  const end = dates.at(-1)
  const axis = view.axis
  if (start === undefined || end === undefined || axis === null) {
    return []
  }
  const startDay = dayNumber(start)
  const endDay = dayNumber(end)
  const daySpan = endDay - startDay
  const marks: string[] = [chartFrame(start, end, axis)]
  const labels: { code: string; paint: string; opacity: string; focused: string; y: number }[] = []
  for (const [seriesIndex, item] of view.series.entries()) {
    const paint = connectGaps ? seriesColor(item.colorIndex ?? seriesIndex) : "currentColor"
    const opacity = focus !== "" && focus !== item.code ? "0.25" : "1"
    let previous: { date: string; price: number; x: number; y: number; dashed: boolean } | null = null
    for (const quote of item.quotes) {
      const x = xAt(quote.date, startDay, daySpan)
      const y = yAt(quote.sellingPrice, axis)
      const dashed = quote.dashed === true
      const delisted = quote.delisted === true
      if (previous !== null && (connectGaps || addDays(previous.date, 1) === quote.date)) {
        const segment = `data-code="${escapeAttribute(item.code)}" data-from-date="${escapeAttribute(previous.date)}" data-from-price="${previous.price}" data-to-date="${escapeAttribute(quote.date)}" data-to-price="${quote.sellingPrice}" x1="${previous.x}" y1="${previous.y}" x2="${x}" y2="${y}"`
        const dash = dashed || previous.dashed ? ` stroke-dasharray="1 0.6"` : ""
        marks.push(
          `<line ${segment} stroke="${paint}" stroke-width="0.6"${dash} fill="none" opacity="${opacity}" pointer-events="none" />`,
        )
        marks.push(
          `<line data-hit="true" ${segment} stroke="transparent" stroke-width="6" fill="none" pointer-events="stroke" />`,
        )
      }
      const ring = delisted ? ` fill="none" stroke="${paint}" stroke-width="0.4"` : ` fill="${paint}"`
      const flagged = delisted ? ` data-delisted="true"` : ""
      marks.push(
        `<circle data-date="${escapeAttribute(quote.date)}" data-price="${quote.sellingPrice}" data-code="${escapeAttribute(item.code)}"${flagged} cx="${x}" cy="${y}" r="${delisted ? "1" : "0.7"}"${ring} opacity="${opacity}" />`,
      )
      previous = { date: quote.date, price: quote.sellingPrice, x, y, dashed }
    }
    if (previous !== null) {
      labels.push({
        code: item.code,
        paint,
        opacity,
        focused: focus === item.code ? "true" : "false",
        y: previous.y,
      })
    }
  }
  const style = labelStyle(labels.length)
  const labelYs = spreadLabelYs(labels.map((label) => label.y), style.gap)
  for (const [index, label] of labels.entries()) {
    const y = labelYs[index] ?? label.y
    marks.push(
      `<text data-series-label="true" data-code="${escapeAttribute(label.code)}" data-focused="${label.focused}" x="${seriesNameX}" y="${y}" font-size="${style.fontSize}" fill="${label.paint}" opacity="${label.opacity}" dominant-baseline="middle" style="cursor:pointer">${escapeHtml(label.code)}</text>`,
    )
  }
  return marks
}

function chartMarks(view: View, connectGaps = false, focus = ""): string {
  return chartMarkList(view, connectGaps, focus).join("")
}

function chipGroupNames(actions: readonly Action[]): string[] {
  const names: string[] = []
  for (const action of actions) {
    if (action.type === "setChipGroup" && action.name !== "" && !names.includes(action.name)) {
      names.push(action.name)
    }
  }
  return names
}

function trendFor(view: View, group: string): string {
  const trend = view.trend.find((item) => item.group === group)
  return trend === undefined ? "" : trendChart(trend)
}

function trendChart(trend: View["trend"][number]): string {
  const bounds = trendBounds(trend)
  if (bounds === null) {
    return ""
  }
  const axis = steppedPriceBounds(bounds.low, bounds.high)
  const startDay = dayNumber(bounds.start)
  const daySpan = dayNumber(bounds.end) - startDay
  const marks = [
    chartFrame(bounds.start, bounds.end, axis),
    priceArea(sellingBands(trend.series), "data-selling-band", "#1d4ed8", startDay, daySpan, axis),
    trendLines(trend.used, bounds.start, bounds.end, startDay, daySpan, axis),
    trendUsedMarks(trend.used, startDay, daySpan, axis),
  ].join("")
  return `<section aria-label="價格趨勢" class="flex flex-col gap-2"><h2 class="font-medium">價格趨勢</h2><p data-indicator-caption>${indicatorCaption("month")}</p>${chartSvg(marks, "", 'data-trend-chart data-indicator="month"', { start: bounds.start, end: bounds.end })}</section>`
}

function trendBounds(trend: View["trend"][number]): { start: string; end: string; low: number; high: number } | null {
  let start = ""
  let end = ""
  let low = 0
  let high = 0
  let seen = false
  const add = (date: string, price: number): void => {
    if (!seen) {
      start = date
      end = date
      low = price
      high = price
      seen = true
      return
    }
    if (date < start) {
      start = date
    }
    if (date > end) {
      end = date
    }
    if (price < low) {
      low = price
    }
    if (price > high) {
      high = price
    }
  }
  for (const line of trend.series) {
    for (const quote of line.quotes) {
      add(quote.date, quote.sellingPrice)
    }
  }
  for (const post of trend.used) {
    add(post.date, post.price)
  }
  if (!seen) {
    return null
  }
  for (const months of [1, 3]) {
    for (const point of usedQuarterAverage(trend.used, start, end, months)) {
      const ceiling = sweetCeiling(point)
      if (ceiling < low) {
        low = ceiling
      }
    }
  }
  return { start, end, low, high }
}

function sellingBands(
  series: NonNullable<View["trend"]>["series"],
): { date: string; low: number; high: number }[] {
  const grouped = new Map<string, number[]>()
  for (const line of series) {
    for (const quote of line.quotes) {
      if (quote.delisted === true) {
        continue
      }
      const prices = grouped.get(quote.date) ?? []
      prices.push(quote.sellingPrice)
      grouped.set(quote.date, prices)
    }
  }
  const bands: { date: string; low: number; high: number }[] = []
  for (const [date, prices] of grouped) {
    let low = prices[0] ?? 0
    let high = low
    for (const price of prices) {
      if (price < low) {
        low = price
      }
      if (price > high) {
        high = price
      }
    }
    bands.push({ date, low, high })
  }
  bands.sort((left, right) => left.date.localeCompare(right.date))
  return bands.map((band, index) => rollingExtreme(bands, index))
}

function rollingExtreme(
  bands: readonly { date: string; low: number; high: number }[],
  index: number,
): { date: string; low: number; high: number } {
  const band = bands[index]
  if (band === undefined) {
    return { date: "", low: 0, high: 0 }
  }
  const windowStart = addDays(band.date, -6)
  let low = band.low
  let high = band.high
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const earlier = bands[cursor]
    if (earlier === undefined || earlier.date < windowStart) {
      break
    }
    if (earlier.low < low) {
      low = earlier.low
    }
    if (earlier.high > high) {
      high = earlier.high
    }
  }
  return { date: band.date, low, high }
}

function priceArea(
  bands: readonly { date: string; low: number; high: number }[],
  attribute: string,
  color: string,
  startDay: number,
  daySpan: number,
  axis: { lower: number; upper: number },
): string {
  const upper: string[] = []
  const lower: string[] = []
  const spans: string[] = []
  for (const band of bands) {
    const x = xAt(band.date, startDay, daySpan)
    upper.push(`${x.toFixed(2)} ${yAt(band.high, axis).toFixed(2)}`)
    lower.push(`${x.toFixed(2)} ${yAt(band.low, axis).toFixed(2)}`)
    spans.push(
      `<line ${attribute}="true" data-date="${escapeAttribute(band.date)}" data-low="${band.low}" data-high="${band.high}" x1="${x.toFixed(2)}" y1="${yAt(band.high, axis).toFixed(2)}" x2="${x.toFixed(2)}" y2="${yAt(band.low, axis).toFixed(2)}" stroke="transparent" stroke-width="0" pointer-events="none" />`,
    )
  }
  const start = upper[0]
  if (start === undefined) {
    return ""
  }
  const forward = upper.slice(1).map((point) => `L${point}`).join("")
  const back = [...lower].reverse().map((point) => `L${point}`).join("")
  return `<path ${attribute}="true" d="M${start}${forward}${back}Z" fill="${color}" fill-opacity="0.28" stroke="${color}" stroke-width="0.45" pointer-events="none" />${spans.join("")}`
}

function usedDayPrices(used: readonly { date: string; price: number }[]): { date: string; price: number; count: number }[] {
  const grouped = new Map<string, number[]>()
  for (const post of used) {
    const prices = grouped.get(post.date) ?? []
    prices.push(post.price)
    grouped.set(post.date, prices)
  }
  const days: { date: string; price: number; count: number }[] = []
  for (const [date, prices] of grouped) {
    let sum = 0
    for (const price of prices) {
      sum += price
    }
    days.push({ date, price: sum / prices.length, count: prices.length })
  }
  days.sort((left, right) => left.date.localeCompare(right.date))
  return days
}

function usedQuarterAverage(
  used: readonly { date: string; price: number }[],
  start: string,
  end: string,
  months = 3,
): { date: string; price: number; p25: number; p50: number; posts: number }[] {
  const days = usedDayPrices(used)
  const points: { date: string; price: number; p25: number; p50: number; posts: number }[] = []
  if (days.length === 0 || start > end) {
    return points
  }
  let cursor = start
  while (cursor <= end) {
    const windowStart = addMonths(cursor, -months)
    const prices: number[] = []
    let posts = 0
    for (const day of days) {
      if (day.date < windowStart) {
        continue
      }
      if (day.date > cursor) {
        break
      }
      prices.push(day.price)
      posts += day.count
    }
    if (posts >= 2 && prices.length > 0) {
      let sum = 0
      for (const price of prices) {
        sum += price
      }
      const sorted = [...prices].sort((left, right) => left - right)
      points.push({
        date: cursor,
        price: sum / prices.length,
        p25: rankedPrice(sorted, 25),
        p50: rankedPrice(sorted, 50),
        posts,
      })
    }
    const next = addDays(cursor, 1)
    if (next <= cursor) {
      break
    }
    cursor = next
  }
  return points
}

function rankedPrice(sorted: readonly number[], share: 25 | 50): number {
  const count = sorted.length
  if (share === 50) {
    return rankedSlice(sorted, 0, count)
  }
  return rankedSlice(sorted, 0, Math.floor(count / 2))
}

function rankedSlice(sorted: readonly number[], start: number, end: number): number {
  const count = end - start
  if (count <= 0) {
    return sorted[start] ?? 0
  }
  const mid = start + Math.floor(count / 2)
  if (count % 2 === 1) {
    return sorted[mid] ?? 0
  }
  const left = sorted[mid - 1] ?? 0
  const right = sorted[mid] ?? 0
  return (left + right) / 2
}

const sweetGap = 2000

function sweetCeiling(point: { p25: number; p50: number }): number {
  if (point.p50 - point.p25 < sweetGap) {
    return point.p25 - sweetGap
  }
  return point.p25
}

const monthPostFloor = 5

function usedHybridAverage(
  month: readonly { date: string; price: number; p25: number; p50: number; posts: number }[],
  quarter: readonly { date: string; price: number; p25: number; p50: number; posts: number }[],
): { date: string; price: number; p25: number; p50: number }[] {
  const monthByDate = new Map(month.map((point) => [point.date, point]))
  const seen = new Set<string>()
  const points: { date: string; price: number; p25: number; p50: number }[] = []
  for (const point of quarter) {
    const monthly = monthByDate.get(point.date)
    const chosen = monthly !== undefined && monthly.posts >= monthPostFloor ? monthly : point
    points.push({ date: chosen.date, price: chosen.price, p25: chosen.p25, p50: chosen.p50 })
    seen.add(point.date)
  }
  for (const point of month) {
    if (point.posts >= monthPostFloor && !seen.has(point.date)) {
      points.push({ date: point.date, price: point.price, p25: point.p25, p50: point.p50 })
    }
  }
  points.sort((left, right) => left.date.localeCompare(right.date))
  return points
}

function trendLines(
  used: readonly { date: string; price: number }[],
  start: string,
  end: string,
  startDay: number,
  daySpan: number,
  axis: { lower: number; upper: number },
): string {
  const month = usedQuarterAverage(used, start, end, 1)
  const quarter = usedQuarterAverage(used, start, end, 3)
  return [
    indicatorSeries(month, "month", startDay, daySpan, axis),
    indicatorSeries(quarter, "quarter", startDay, daySpan, axis),
    indicatorSeries(usedHybridAverage(month, quarter), "hybrid", startDay, daySpan, axis),
  ].join("")
}

export function indicatorLabel(window: IndicatorWindow): string {
  if (window === "month") {
    return "月均線"
  }
  if (window === "quarter") {
    return "季均線"
  }
  return "月季均線"
}

function indicatorCaption(window: IndicatorWindow): string {
  const sweet = "價差 2,000 元以上時，甜蜜區在 25% 區間線以下；未達 2,000 元時，甜蜜區在 25% 區間再低 2,000 元以下。"
  const lead = "藍色面積是過去 7 日售價的最高價到最低價，琥珀色面積是甜蜜區，圓點是二手開價，"
  if (window === "hybrid") {
    return `${lead}深色線是二手開價的月季均線。月窗口滿 5 筆時，青線、紫線與甜蜜區用一個月窗口；未滿 5 筆時，改用一季窗口。${sweet}`
  }
  const average = indicatorLabel(window)
  const span = window === "month" ? "一個月" : "一季"
  return `${lead}深色線是二手開價的${average}，青線是同${span}窗口的 50% 區間，紫線是 25% 區間。${sweet}`
}

export function applyIndicator(root: ParentNode, window: IndicatorWindow): void {
  for (const svg of root.querySelectorAll("svg[data-trend-chart]")) {
    svg.setAttribute("data-indicator", window)
    for (const node of svg.querySelectorAll("[data-window]")) {
      if (node.getAttribute("data-window") === window) {
        node.removeAttribute("hidden")
      } else {
        node.setAttribute("hidden", "")
      }
    }
  }
  for (const caption of root.querySelectorAll("[data-indicator-caption]")) {
    caption.textContent = indicatorCaption(window)
  }
}

function indicatorSeries(
  points: readonly { date: string; price: number; p25: number; p50: number }[],
  window: IndicatorWindow,
  startDay: number,
  daySpan: number,
  axis: { lower: number; upper: number },
): string {
  return [
    sweetArea(points, startDay, daySpan, axis, window),
    trendPath(points, (point) => point.price, "data-average", "data-trend", "#1e3a5f", "", startDay, daySpan, axis, window),
    trendPath(points, (point) => point.p50, 'data-percentile="50"', 'data-percentile="50"', "#0f766e", "", startDay, daySpan, axis, window),
    trendPath(points, (point) => point.p25, 'data-percentile="25"', 'data-percentile="25"', "#7c3aed", ' stroke-dasharray="1.4 0.9"', startDay, daySpan, axis, window),
  ].join("")
}

function sweetArea(
  points: readonly { date: string; price: number; p25: number; p50: number }[],
  startDay: number,
  daySpan: number,
  axis: { lower: number; upper: number },
  window: IndicatorWindow,
): string {
  const floor = plotBottom.toFixed(2)
  const commands: string[] = []
  const spans: string[] = []
  let upper: string[] = []
  let lower: string[] = []
  let previous = ""
  const flush = (): void => {
    const start = upper[0]
    if (start === undefined) {
      return
    }
    const forward = upper.slice(1).map((point) => `L${point}`).join("")
    const back = [...lower].reverse().map((point) => `L${point}`).join("")
    commands.push(`M${start}${forward}${back}Z`)
    upper = []
    lower = []
  }
  for (const point of points) {
    if (previous !== "" && addDays(previous, 1) !== point.date) {
      flush()
    }
    const ceiling = sweetCeiling(point)
    const x = xAt(point.date, startDay, daySpan).toFixed(2)
    const y = yAt(ceiling, axis).toFixed(2)
    upper.push(`${x} ${y}`)
    lower.push(`${x} ${floor}`)
    spans.push(
      `<line data-sweet-zone="true" data-window="${window}"${indicatorHidden(window)} data-date="${escapeAttribute(point.date)}" data-price="${ceiling}" x1="${x}" y1="${y}" x2="${x}" y2="${floor}" stroke="transparent" stroke-width="0" pointer-events="none" />`,
    )
    previous = point.date
  }
  flush()
  if (commands.length === 0) {
    return ""
  }
  return `<path data-sweet-zone="true" data-window="${window}"${indicatorHidden(window)} d="${commands.join("")}" fill="#d97706" fill-opacity="0.45" stroke="#d97706" stroke-width="0.35" pointer-events="none" />${spans.join("")}`
}

function trendPath(
  points: readonly { date: string; price: number; p25: number; p50: number }[],
  priceOf: (point: { date: string; price: number; p25: number; p50: number }) => number,
  markAttribute: string,
  pathAttribute: string,
  color: string,
  dash: string,
  startDay: number,
  daySpan: number,
  axis: { lower: number; upper: number },
  window: IndicatorWindow,
): string {
  if (points.length === 0) {
    return ""
  }
  let path = ""
  let previous = ""
  const marks: string[] = []
  for (const point of points) {
    const price = priceOf(point)
    const x = xAt(point.date, startDay, daySpan).toFixed(2)
    const y = yAt(price, axis).toFixed(2)
    const command = previous !== "" && addDays(previous, 1) === point.date ? "L" : "M"
    path += `${command}${x} ${y}`
    previous = point.date
    marks.push(
      `<circle ${markAttribute} data-window="${window}"${indicatorHidden(window)} data-date="${escapeAttribute(point.date)}" data-price="${price}" cx="${x}" cy="${y}" r="0" fill="none" pointer-events="none" />`,
    )
  }
  return `<path ${pathAttribute} data-window="${window}"${indicatorHidden(window)} d="${path}" fill="none" stroke="${color}" stroke-width="0.7"${dash} pointer-events="none" />${marks.join("")}`
}

function trendUsedMarks(
  used: readonly { code: string; date: string; price: number; link: string }[],
  startDay: number,
  daySpan: number,
  axis: { lower: number; upper: number },
): string {
  return used.map((post) => {
    const x = xAt(post.date, startDay, daySpan)
    const y = yAt(post.price, axis)
    const point = `cx="${x.toFixed(2)}" cy="${y.toFixed(2)}"`
    const hit = `<circle data-used-price="true" data-code="${escapeAttribute(post.code)}" data-date="${escapeAttribute(post.date)}" data-price="${post.price}" ${point} r="3.2" fill="transparent" stroke="none" />`
    const dot = `<circle ${point} r="1.2" fill="#c2410c" stroke="#ffffff" stroke-width="0.3" pointer-events="none" />`
    return `<a href="${escapeAttribute(post.link)}" target="_blank" rel="noreferrer">${hit}${dot}</a>`
  }).join("")
}

function filterSection(view: View, actions: readonly Action[]): string {
  const chipGroups = chipGroupNames(actions)
  const rangeStart = view.queryRange === null ? "" : view.queryRange.start
  const rangeEnd = view.queryRange === null ? "" : view.queryRange.end
  const candidates = listingTableMarkup(view.listings.map((row) => ({
    code: row.code,
    price: formatSellingPrice(row.sellingPrice),
    date: row.date,
    pressed: view.selected.includes(row.code),
  })))
  const selected = selectedListMarkup(view.selected)
  const generation = chipGroups.length === 0 ? view.generation : ""
  return `<section class="mb-6 flex flex-col gap-6 text-sm">
      <h2>篩選</h2>
      ${generationMarkup(generation)}
      <label>起日 <input type="date" aria-label="起日" value="${escapeAttribute(rangeStart)}"></label>
      <label>迄日 <input type="date" aria-label="迄日" value="${escapeAttribute(rangeEnd)}"></label>
      <div>核心規格 ${chipVendorMarkup()}${chipGroupMarkup(view.chipGroups, chipGroups)}</div>
      ${buttonMarkup("搜尋", { "aria-label": "搜尋" })}
      ${candidates}
      <ul aria-label="已選">${selected}</ul>
    </section>`
}

export function selectedListMarkup(codes: readonly string[]): string {
  return codes
    .map((code) => `<li><span>${escapeHtml(code)}</span>${buttonMarkup("拿掉", { "data-code": code })}</li>`)
    .join("")
}

function sharedBrandNames(view: View): string[] {
  const names: string[] = []
  for (const chart of view.modelCharts) {
    for (const name of chart.brands) {
      if (!names.includes(name)) {
        names.push(name)
      }
    }
  }
  const rank = ["華碩", "技嘉", "微星", "INNO3D", "ZOTAC", "其他"]
  return names.sort((left, right) => {
    const leftRank = rank.indexOf(left)
    const rightRank = rank.indexOf(right)
    return (leftRank < 0 ? rank.length : leftRank) - (rightRank < 0 ? rank.length : rightRank)
  })
}

function chartRangeMarkup(): string {
  const options: { label: string; mode: ChartRange }[] = [
    { label: "整張", mode: "fit" },
    { label: "12 個月", mode: "12" },
    { label: "6 個月", mode: "6" },
    { label: "3 個月", mode: "3" },
  ]
  const buttons = options
    .map((option) => buttonMarkup(option.label, {
      "aria-pressed": option.mode === "12" ? "true" : "false",
      "aria-label": option.label,
    }))
    .join("")
  return `<div role="group" aria-label="圖表日期範圍" class="flex flex-col gap-2">${buttons}</div>`
}

function indicatorHidden(window: IndicatorWindow): string {
  return window === "month" ? "" : " hidden"
}

function indicatorMarkup(): string {
  const options: IndicatorWindow[] = ["month", "quarter", "hybrid"]
  const buttons = options
    .map((option) => buttonMarkup(indicatorLabel(option), {
      "aria-pressed": option === "month" ? "true" : "false",
      "aria-label": indicatorLabel(option),
    }))
    .join("")
  return `<div role="group" aria-label="指標" class="flex flex-col gap-2">${buttons}</div>`
}

function chartControlMarkup(view: View): string {
  const selected = view.modelCharts[0]?.selectedBrands ?? []
  const onSale = buttonMarkup("僅顯示在售", {
    "aria-pressed": view.onSaleOnly ? "true" : "false",
    "aria-label": "僅顯示在售",
  })
  const brands = brandMarkup(sharedBrandNames(view), selected)
  const collapse = buttonMarkup("收合", { "aria-label": "收合側邊欄" })
  const separator = `<div role="separator" class="my-4 w-full border-t border-slate-300"></div>`
  return `<aside class="sticky top-0 z-20 flex h-dvh shrink-0 bg-white" aria-label="側邊欄"><div class="flex h-full max-h-dvh flex-col gap-2 overflow-y-auto px-3 py-3 [&_button]:whitespace-nowrap">${collapse}<div data-sidebar-panel class="flex flex-col gap-2">${chartRangeMarkup()}${separator}${indicatorMarkup()}${separator}${onSale}<div aria-label="品牌" class="flex flex-col gap-2">${brands}</div></div></div></aside>`
}

function documentHtml(body: string, controls: string): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <body>
    <div class="flex items-start">
      ${controls}
      <div class="min-w-0 flex-1 p-4 md:p-6">
      ${body}
      </div>
    </div>
  </body>
</html>`
}

export function renderShell(view: View, actions: readonly Action[]): string {
  return documentHtml(filterSection(view, actions), chartControlMarkup(view))
}

export function renderPage(series: PriceSeries, actions: readonly Action[], usedPosts: readonly UsedPost[] = []): string {
  preparedBrandSvgs.clear()
  const view = present(series, actions, usedPosts)
  const charts = view.modelCharts.map((chart) => modelSection(view, chart)).join("")
  return documentHtml(`${filterSection(view, actions)}${charts}`, chartControlMarkup(view))
}

function formatSellingPrice(price: number): string {
  const rounded = Math.round(price)
  const negative = rounded < 0
  const digits = String(Math.abs(rounded))
  let grouped = ""
  for (let index = 0; index < digits.length; index += 1) {
    const remaining = digits.length - index
    if (index > 0 && remaining % 3 === 0) {
      grouped += ","
    }
    grouped += digits.charAt(index)
  }
  return negative ? `-$${grouped}` : `$${grouped}`
}

function modelSvg(
  view: View,
  lines: readonly { code: string; brand: string; quotes: readonly { date: string; sellingPrice: number }[] }[],
  focus: string,
  used: readonly UsedBox[],
): string {
  const series = lines.map((line) => ({
    code: line.code,
    colorIndex: brandColorIndex(line.brand),
    quotes: line.quotes,
  }))
  return chartSvg(chartMarks({
    queryRange: view.queryRange,
    chipGroups: [],
    candidates: [],
    listings: [],
    selected: [],
    series,
    axis: priceBounds(series, extraPrices(lines, used)),
    readout: null,
    onSaleOnly: false,
    generation: "50",
    modelCharts: [],
    trend: [],
  }, true, focus), "", "data-price-chart", spanOf(lines))
}

function chartSection(group: string, svg: string, used: string, trend = ""): string {
  return `<section class="flex flex-col gap-2 text-sm" aria-label="${escapeAttribute(group)}"><h3 class="font-medium">${escapeHtml(group)}</h3>${svg}${trend}${used}</section>`
}

export function brandCacheKey(names: readonly string[]): string {
  return [...names].sort().join("\0")
}

export function chartCacheKey(names: readonly string[], onSaleOnly = false): string {
  const brands = brandCacheKey(names)
  return onSaleOnly ? `${brands}\u0001在售` : brands
}

function visibleLines(chart: View["modelCharts"][number], onSaleOnly: boolean): View["modelCharts"][number]["allSeries"] {
  const branded = chart.selectedBrands.length === 0
    ? chart.allSeries
    : chart.allSeries.filter((line) => chart.selectedBrands.includes(brandGroup(line.brand)))
  if (!onSaleOnly) {
    return branded
  }
  return branded.filter((line) => line.onSale)
}

function modelSection(view: View, chart: View["modelCharts"][number]): string {
  const stored = new Map<string, string>()
  stored.set("", modelSvg(view, chart.allSeries, "", chart.used))
  for (const name of chart.brands) {
    const lines = chart.allSeries.filter((line) => brandGroup(line.brand) === name)
    stored.set(name, modelSvg(view, lines, "", chart.used))
  }
  preparedBrandSvgs.set(chart.group, stored)
  const lines = visibleLines(chart, view.onSaleOnly)
  const visible = modelSvg(view, lines, chart.focus, chart.used)
  stored.set(chartCacheKey(chart.selectedBrands, view.onSaleOnly), visible)
  const selling = chart.allSeries.filter((line) => line.onSale)
  stored.set(chartCacheKey([], true), modelSvg(view, selling, "", chart.used))
  return chartSection(chart.group, visible, usedStrip(lines, chart.used), trendFor(view, chart.group))
}

export function clearPreparedCharts(): void {
  preparedBrandSvgs.clear()
}

export function storeBrandChart(group: string, brand: string, markup: string): void {
  const stored = preparedBrandSvgs.get(group) ?? new Map<string, string>()
  stored.set(brand, markup)
  preparedBrandSvgs.set(group, stored)
}

export function renderBrandSvg(view: View, group: string, brands: readonly string[], onSaleOnly = false): string | null {
  const key = chartCacheKey(brands, onSaleOnly)
  const cached = preparedBrandChart(group, key)
  if (cached !== null) {
    return cached
  }
  const chart = view.modelCharts.find((item) => item.group === group)
  if (chart === undefined) {
    return null
  }
  const branded = brands.length === 0
    ? chart.allSeries
    : chart.allSeries.filter((line) => brands.includes(brandGroup(line.brand)))
  const lines = onSaleOnly ? branded.filter((line) => line.onSale) : branded
  const markup = modelSvg(view, lines, "", chart.used)
  storeBrandChart(group, key, markup)
  return markup
}

export function usedMarkup(view: View, group: string, brands: readonly string[], onSaleOnly = false): string {
  const chart = view.modelCharts.find((item) => item.group === group)
  if (chart === undefined) {
    return ""
  }
  const branded = brands.length === 0
    ? chart.allSeries
    : chart.allSeries.filter((line) => brands.includes(brandGroup(line.brand)))
  const lines = onSaleOnly ? branded.filter((line) => line.onSale) : branded
  return usedStrip(lines, chart.used)
}

export function visibleChart(
  view: View,
  chart: View["modelCharts"][number],
): { section: string; marks: string[] } {
  const lines = visibleLines(chart, view.onSaleOnly)
  const series = lines.map((line) => ({
    code: line.code,
    colorIndex: brandColorIndex(line.brand),
    quotes: line.quotes,
  }))
  const marks = chartMarkList({
    queryRange: view.queryRange,
    chipGroups: [],
    candidates: [],
    listings: [],
    selected: [],
    series,
    axis: priceBounds(series, extraPrices(lines, chart.used)),
    readout: null,
    onSaleOnly: false,
    generation: "50",
    modelCharts: [],
    trend: [],
  }, true, chart.focus)
  const frame = marks[0] ?? ""
  return { section: chartSection(chart.group, chartSvg(frame, "", "data-price-chart", spanOf(lines)), usedStrip(lines, chart.used), trendFor(view, chart.group)), marks: marks.slice(1) }
}

function extraPrices(lines: readonly { code: string }[], used: readonly UsedBox[]): number[] {
  const codes = new Set(lines.map((line) => line.code))
  const prices: number[] = []
  for (const box of used) {
    if (!codes.has(box.code)) {
      continue
    }
    prices.push(box.min, box.max)
  }
  return prices
}

function usedStrip(
  lines: readonly { code: string; brand: string; quotes: readonly { date: string; sellingPrice: number }[] }[],
  used: readonly UsedBox[],
): string {
  const codes = new Set(lines.map((line) => line.code))
  const boxes = used.filter((box) => codes.has(box.code))
  if (boxes.length === 0) {
    return ""
  }
  const axis = priceBounds(lines, extraPrices(lines, boxes))
  if (axis === null) {
    return ""
  }
  const ticks = priceTicks(axis.lower, axis.upper).filter((price, index, all) => index % 2 === 0 || price === all.at(-1))
  const labels = ticks.map((price) =>
    `<text data-used-axis="y" x="62" y="${yAt(price, axis).toFixed(2)}" font-size="8" fill="#334155" text-anchor="end" dominant-baseline="middle">${formatPrice(price)}</text>`,
  ).join("")
  const axisSvg = `<svg aria-hidden="true" viewBox="0 0 64 100" width="128" height="200"><path d="M63 ${plotTop} V${plotBottom}" fill="none" stroke="#334155" stroke-width="0.6" />${labels}</svg>`
  const figures = boxes.map((box) => {
    const posts = [...box.posts].sort((left, right) => left.date.localeCompare(right.date) || left.price - right.price)
    const links = posts.map((post) =>
      `<a class="block underline" href="${escapeAttribute(post.link)}" target="_blank" rel="noreferrer">${escapeHtml(post.date)} ${formatSellingPrice(post.price)}</a>`,
    ).join("")
    return `<figure class="flex w-36 flex-col items-center gap-1"><svg viewBox="0 0 28 100" width="56" height="200" aria-label="盒鬚圖">${boxMarks(box, axis)}</svg><figcaption class="w-full text-xs"><div class="font-medium">${escapeHtml(box.code)}</div>${links}</figcaption></figure>`
  }).join("")
  return `<div data-used aria-label="二手行情" class="my-6 flex flex-col gap-2"><p class="font-medium">二手行情</p><div class="flex items-start gap-3 overflow-x-auto">${axisSvg}${figures}</div></div>`
}

function boxMarks(box: UsedBox, axis: { lower: number; upper: number }): string {
  const yMin = yAt(box.min, axis)
  const yMax = yAt(box.max, axis)
  const yQ1 = yAt(box.q1, axis)
  const yQ3 = yAt(box.q3, axis)
  const yMedian = yAt(box.median, axis)
  const rawHeight = Math.abs(yQ1 - yQ3)
  const height = rawHeight < 0.8 ? 0.8 : rawHeight
  const top = rawHeight < 0.8 ? yMedian - 0.4 : Math.min(yQ1, yQ3)
  const left = 6
  const right = 22
  const mid = 14
  const cap = 4
  return [
    `<g data-box data-code="${escapeAttribute(box.code)}" data-min="${box.min}" data-q1="${box.q1}" data-median="${box.median}" data-q3="${box.q3}" data-max="${box.max}">`,
    `<path d="M${mid - cap} ${yMax.toFixed(2)} H${mid + cap} M${mid} ${yMax.toFixed(2)} V${yMin.toFixed(2)} M${mid - cap} ${yMin.toFixed(2)} H${mid + cap}" fill="none" stroke="#334155" stroke-width="0.6" />`,
    `<rect x="${left}" y="${top.toFixed(2)}" width="${right - left}" height="${height.toFixed(2)}" fill="#e8eef7" stroke="#334155" stroke-width="0.6" />`,
    `<path data-median d="M${left} ${yMedian.toFixed(2)} H${right}" fill="none" stroke="#334155" stroke-width="1.2" />`,
    "</g>",
  ].join("")
}

function priceBounds(
  series: readonly { quotes: readonly { sellingPrice: number }[] }[],
  extras: readonly number[] = [],
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
  for (const price of extras) {
    if (min === null || price < min) {
      min = price
    }
    if (max === null || price > max) {
      max = price
    }
  }
  if (min === null || max === null) {
    return null
  }
  return steppedPriceBounds(min, max)
}
