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

function longerThanYear(start: string, end: string): boolean {
  const limit = addMonths(start, 12)
  return limit !== "" && end > limit
}

function yearScale(start: string, end: string): number | null {
  if (!longerThanYear(start, end)) {
    return null
  }
  const windowDays = dayNumber(addMonths(start, 12)) - dayNumber(start)
  const span = dayNumber(end) - dayNumber(start)
  if (windowDays <= 0 || span <= windowDays) {
    return null
  }
  return span / windowDays
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
  if (span === null || !longerThanYear(span.start, span.end)) {
    return svg
  }
  const fit = buttonMarkup("整張", { "aria-pressed": "true", "aria-label": "整張" })
  const months = buttonMarkup("十二個月", { "aria-pressed": "false", "aria-label": "十二個月" })
  return `<div data-chart-width data-mode="fit"><div role="group" aria-label="圖表寬度" class="flex flex-wrap gap-2">${fit}${months}</div><div data-chart-window class="w-full max-w-full overflow-x-auto">${svg}</div></div>`
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

function pressWidth(svg: Element, mode: "fit" | "months"): void {
  const host = chartHost(svg)
  if (host === null) {
    return
  }
  host.setAttribute("data-mode", mode)
  const selected = mode === "months" ? "十二個月" : "整張"
  for (const button of host.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", button.getAttribute("aria-label") === selected ? "true" : "false")
  }
}

export function applyChartMode(svg: SVGSVGElement, mode: "fit" | "months"): void {
  const start = svg.getAttribute("data-chart-start") ?? ""
  const end = svg.getAttribute("data-chart-end") ?? ""
  const scale = yearScale(start, end)
  if (scale === null) {
    return
  }
  const current = svg.getAttribute("data-mode") ?? "fit"
  if (current === mode) {
    return
  }
  if (mode === "fit") {
    restoreAxis(svg)
    scaleTree(svg, scale, false)
    svg.setAttribute("viewBox", "0 0 400 100")
    svg.setAttribute("width", "100%")
    svg.setAttribute("style", "display:block;width:100%;height:auto;aspect-ratio:4/1")
    svg.setAttribute("data-mode", "fit")
    pressWidth(svg, "fit")
    return
  }
  scaleTree(svg, scale, true)
  parkAxis(svg, scale)
  const plotWidth = plotLeft + plotSpan * scale
  svg.setAttribute("viewBox", `0 0 ${plotWidth} 100`)
  svg.setAttribute("width", `${(plotWidth / 270) * 100}%`)
  svg.setAttribute("style", `display:block;width:${(plotWidth / 270) * 100}%;height:auto;aspect-ratio:${plotWidth}/100`)
  svg.setAttribute("data-mode", "months")
  pressWidth(svg, "months")
  const windowEl = svg.closest("[data-chart-window]")
  if (windowEl instanceof HTMLElement) {
    windowEl.scrollLeft = windowEl.scrollWidth
  }
}

export function adoptChartMark(svg: SVGSVGElement, node: Element): void {
  if ((svg.getAttribute("data-mode") ?? "fit") !== "months") {
    return
  }
  const scale = yearScale(svg.getAttribute("data-chart-start") ?? "", svg.getAttribute("data-chart-end") ?? "")
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
  const laneCount = view.series.length
  const laneHeight = laneCount === 0 ? plotBottom - plotTop : (plotBottom - plotTop) / laneCount
  const labels: { code: string; paint: string; opacity: string; focused: string; y: number }[] = []
  for (const [seriesIndex, item] of view.series.entries()) {
    const quoted = new Set(item.quotes.map((quote) => quote.date))
    for (const date of dates) {
      if (quoted.has(date)) {
        continue
      }
      const x = xAt(date, startDay, daySpan)
      marks.push(
        `<rect data-day="${escapeAttribute(date)}" data-code="${escapeAttribute(item.code)}" x="${x - 1}" y="${plotTop + seriesIndex * laneHeight}" width="2" height="${laneHeight}" fill="transparent" pointer-events="none" />`,
      )
    }
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
    priceArea(usedHalfBands(trend.used, bounds.start, bounds.end), "data-used-band", "#c2410c", startDay, daySpan, axis),
    trendAverage(trend.used, bounds.start, bounds.end, startDay, daySpan, axis),
    trendUsedMarks(trend.used, startDay, daySpan, axis),
  ].join("")
  return `<section aria-label="價格趨勢" class="flex flex-col gap-2"><h2 class="font-medium">價格趨勢</h2><p>藍色面積是每日售價的最高價到最低價，橘色面積是半月二手開價的最高價到最低價，圓點是二手開價，深色線是二手開價的季均線。</p>${chartSvg(marks, "", "data-trend-chart", { start: bounds.start, end: bounds.end })}</section>`
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
  return bands
}

function usedHalfBands(
  used: readonly { date: string; price: number }[],
  start: string,
  end: string,
): { date: string; low: number; high: number }[] {
  const ranges = new Map<string, { low: number; high: number }>()
  for (const post of used) {
    const key = halfMonthKey(post.date)
    const range = ranges.get(key)
    if (range === undefined) {
      ranges.set(key, { low: post.price, high: post.price })
      continue
    }
    if (post.price < range.low) {
      range.low = post.price
    }
    if (post.price > range.high) {
      range.high = post.price
    }
  }
  const bands: { date: string; low: number; high: number }[] = []
  if (ranges.size === 0 || start > end) {
    return bands
  }
  let cursor = start
  while (cursor <= end) {
    const range = ranges.get(halfMonthKey(cursor))
    if (range !== undefined) {
      bands.push({ date: cursor, low: range.low, high: range.high })
    }
    const next = addDays(cursor, 1)
    if (next <= cursor) {
      break
    }
    cursor = next
  }
  return bands
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

function halfMonthKey(isoDate: string): string {
  const day = Number(isoDate.slice(8, 10))
  return `${isoDate.slice(0, 7)}-${day <= 15 ? "01" : "16"}`
}

function usedQuarterAverage(
  used: readonly { date: string; price: number }[],
  start: string,
  end: string,
): { date: string; price: number }[] {
  const days = usedDayPrices(used)
  const points: { date: string; price: number }[] = []
  if (days.length === 0 || start > end) {
    return points
  }
  let cursor = start
  while (cursor <= end) {
    const windowStart = addMonths(cursor, -3)
    let sum = 0
    let count = 0
    let posts = 0
    for (const day of days) {
      if (day.date < windowStart) {
        continue
      }
      if (day.date > cursor) {
        break
      }
      sum += day.price
      count += 1
      posts += day.count
    }
    if (posts >= 2 && count > 0) {
      points.push({ date: cursor, price: sum / count })
    }
    const next = addDays(cursor, 1)
    if (next <= cursor) {
      break
    }
    cursor = next
  }
  return points
}

function trendAverage(
  used: readonly { date: string; price: number }[],
  start: string,
  end: string,
  startDay: number,
  daySpan: number,
  axis: { lower: number; upper: number },
): string {
  const points = usedQuarterAverage(used, start, end)
  if (points.length === 0) {
    return ""
  }
  let path = ""
  let previous = ""
  const marks: string[] = []
  for (const point of points) {
    const x = xAt(point.date, startDay, daySpan).toFixed(2)
    const y = yAt(point.price, axis).toFixed(2)
    const command = previous !== "" && addDays(previous, 1) === point.date ? "L" : "M"
    path += `${command}${x} ${y}`
    previous = point.date
    marks.push(
      `<circle data-average="true" data-date="${escapeAttribute(point.date)}" data-price="${point.price}" cx="${x}" cy="${y}" r="0" fill="none" pointer-events="none" />`,
    )
  }
  return `<path data-trend="true" d="${path}" fill="none" stroke="#1e3a5f" stroke-width="0.7" pointer-events="none" />${marks.join("")}`
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
    const circle = `<circle data-used-price="true" data-code="${escapeAttribute(post.code)}" data-date="${escapeAttribute(post.date)}" data-price="${post.price}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.2" fill="#c2410c" stroke="#ffffff" stroke-width="0.3" />`
    return `<a href="${escapeAttribute(post.link)}" target="_blank" rel="noreferrer">${circle}</a>`
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
      <div>晶片分組 ${chipVendorMarkup()}${chipGroupMarkup(view.chipGroups, chipGroups)}</div>
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

function chartControlMarkup(view: View): string {
  const selected = view.modelCharts[0]?.selectedBrands ?? []
  const onSale = buttonMarkup("僅顯示在售", {
    "aria-pressed": view.onSaleOnly ? "true" : "false",
    "aria-label": "僅顯示在售",
  })
  const brands = brandMarkup(sharedBrandNames(view), selected)
  return `<aside class="sticky top-0 z-20 flex h-dvh shrink-0 items-center bg-white" aria-label="圖表篩選"><div class="flex flex-col gap-2 px-3 [&_button]:whitespace-nowrap">${onSale}<div aria-label="品牌" class="flex flex-col gap-2">${brands}</div></div></aside>`
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
