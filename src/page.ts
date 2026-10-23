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

function chartSvg(marks: string, label = ""): string {
  const named = label === "" ? "" : ` aria-label="${label}"`
  return `<svg data-price-chart${named} viewBox="0 0 400 100" width="100%" style="display:block;width:100%;height:auto;aspect-ratio:4/1">${marks}</svg>`
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
        const dash = dashed || previous.dashed ? ` stroke-dasharray="2 1.2"` : ""
        marks.push(
          `<line ${segment} stroke="${paint}" stroke-width="1.2"${dash} fill="none" opacity="${opacity}" pointer-events="none" />`,
        )
        marks.push(
          `<line data-hit="true" ${segment} stroke="transparent" stroke-width="6" fill="none" pointer-events="stroke" />`,
        )
      }
      const ring = delisted ? ` fill="none" stroke="${paint}" stroke-width="0.6"` : ` fill="${paint}"`
      const flagged = delisted ? ` data-delisted="true"` : ""
      marks.push(
        `<circle data-date="${escapeAttribute(quote.date)}" data-price="${quote.sellingPrice}" data-code="${escapeAttribute(item.code)}"${flagged} cx="${x}" cy="${y}" r="${delisted ? "1.6" : "1.2"}"${ring} opacity="${opacity}" />`,
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
  const selected = view.selected
    .map((code) => `<li><span>${escapeHtml(code)}</span>${buttonMarkup("拿掉", { "data-code": code })}</li>`)
    .join("")
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

function documentHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <body>
    <div class="p-4 md:p-6">
    ${body}
    </div>
  </body>
</html>`
}

export function renderShell(view: View, actions: readonly Action[]): string {
  return documentHtml(filterSection(view, actions))
}

export function renderPage(series: PriceSeries, actions: readonly Action[], usedPosts: readonly UsedPost[] = []): string {
  preparedBrandSvgs.clear()
  const view = present(series, actions, usedPosts)
  const charts = view.modelCharts.map((chart) => modelSection(view, chart)).join("")
  return documentHtml(`${filterSection(view, actions)}${charts}`)
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
    generation: "50",
    modelCharts: [],
  }, true, focus))
}

function chartSection(group: string, brands: string, svg: string, used: string): string {
  return `<section class="flex flex-col gap-2 text-sm" aria-label="${escapeAttribute(group)}"><h3 class="font-medium">${escapeHtml(group)}</h3><div aria-label="品牌" class="flex flex-wrap gap-2">${brands}</div>${svg}${used}</section>`
}

export function brandCacheKey(names: readonly string[]): string {
  return [...names].sort().join("\0")
}

function visibleLines(chart: View["modelCharts"][number]): View["modelCharts"][number]["allSeries"] {
  if (chart.selectedBrands.length === 0) {
    return chart.allSeries
  }
  return chart.allSeries.filter((line) => chart.selectedBrands.includes(brandGroup(line.brand)))
}

function modelSection(view: View, chart: View["modelCharts"][number]): string {
  const stored = new Map<string, string>()
  stored.set("", modelSvg(view, chart.allSeries, "", chart.used))
  for (const name of chart.brands) {
    const lines = chart.allSeries.filter((line) => brandGroup(line.brand) === name)
    stored.set(name, modelSvg(view, lines, "", chart.used))
  }
  preparedBrandSvgs.set(chart.group, stored)
  const brands = brandMarkup(chart.brands, chart.selectedBrands)
  const lines = visibleLines(chart)
  const visible = modelSvg(view, lines, chart.focus, chart.used)
  stored.set(brandCacheKey(chart.selectedBrands), visible)
  return chartSection(chart.group, brands, visible, usedStrip(lines, chart.used))
}

export function clearPreparedCharts(): void {
  preparedBrandSvgs.clear()
}

export function storeBrandChart(group: string, brand: string, markup: string): void {
  const stored = preparedBrandSvgs.get(group) ?? new Map<string, string>()
  stored.set(brand, markup)
  preparedBrandSvgs.set(group, stored)
}

export function renderBrandSvg(view: View, group: string, brands: readonly string[]): string | null {
  const key = brandCacheKey(brands)
  const cached = preparedBrandChart(group, key)
  if (cached !== null) {
    return cached
  }
  const chart = view.modelCharts.find((item) => item.group === group)
  if (chart === undefined) {
    return null
  }
  const lines = brands.length === 0
    ? chart.allSeries
    : chart.allSeries.filter((line) => brands.includes(brandGroup(line.brand)))
  const markup = modelSvg(view, lines, "", chart.used)
  storeBrandChart(group, key, markup)
  return markup
}

export function usedMarkup(view: View, group: string, brands: readonly string[]): string {
  const chart = view.modelCharts.find((item) => item.group === group)
  if (chart === undefined) {
    return ""
  }
  const lines = brands.length === 0
    ? chart.allSeries
    : chart.allSeries.filter((line) => brands.includes(brandGroup(line.brand)))
  return usedStrip(lines, chart.used)
}

export function visibleChart(
  view: View,
  chart: View["modelCharts"][number],
): { section: string; marks: string[] } {
  const lines = visibleLines(chart)
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
    generation: "50",
    modelCharts: [],
  }, true, chart.focus)
  const frame = marks[0] ?? ""
  const brands = brandMarkup(chart.brands, chart.selectedBrands)
  return { section: chartSection(chart.group, brands, chartSvg(frame), usedStrip(lines, chart.used)), marks: marks.slice(1) }
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
  return `<div data-used aria-label="二手行情" class="flex flex-col gap-2"><p class="font-medium">二手行情</p><div class="flex items-start gap-3 overflow-x-auto">${axisSvg}${figures}</div></div>`
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
