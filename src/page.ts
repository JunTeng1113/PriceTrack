import { brandMarkup, buttonMarkup, chipGroupMarkup, chipVendorMarkup, keywordMarkup } from "./fields.tsx"
import { brandColorIndex, present, steppedPriceBounds, type Action, type PriceSeries, type View } from "./present.ts"

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
  const hue = (index * 47) % 360
  return `hsl(${hue} 70% 35%)`
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
  return String(Math.round(value))
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
  const xLabels = months.map((tick) => {
    const x = xAt(tick.date, startDay, daySpan)
    const anchor = x <= plotLeft + 8 ? "start" : x >= plotRight - 8 ? "end" : "middle"
    return `<text data-axis="x" x="${x}" y="96" font-size="3.2" fill="#334155" text-anchor="${anchor}">${escapeHtml(tick.label)}</text>`
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
  return `<svg${named} viewBox="0 0 400 100" width="100%" style="display:block;width:100%;height:auto;aspect-ratio:4/1">${marks}</svg>`
}

function chartMarks(view: View, connectGaps = false, focus = ""): string {
  const dates = axisDates(view)
  const start = dates[0]
  const end = dates.at(-1)
  const axis = view.axis
  if (start === undefined || end === undefined || axis === null) {
    return ""
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
        `<rect data-day="${escapeAttribute(date)}" data-code="${escapeAttribute(item.code)}" x="${x - 1}" y="${plotTop + seriesIndex * laneHeight}" width="2" height="${laneHeight}" fill="transparent" />`,
      )
    }
    const paint = connectGaps ? seriesColor(item.colorIndex ?? seriesIndex) : "currentColor"
    const opacity = focus !== "" && focus !== item.code ? "0.25" : "1"
    let previous: { date: string; price: number; x: number; y: number } | null = null
    for (const quote of item.quotes) {
      const x = xAt(quote.date, startDay, daySpan)
      const y = yAt(quote.sellingPrice, axis)
      if (previous !== null && (connectGaps || addDays(previous.date, 1) === quote.date)) {
        const segment = `data-code="${escapeAttribute(item.code)}" data-from-date="${escapeAttribute(previous.date)}" data-from-price="${previous.price}" data-to-date="${escapeAttribute(quote.date)}" data-to-price="${quote.sellingPrice}" x1="${previous.x}" y1="${previous.y}" x2="${x}" y2="${y}"`
        marks.push(
          `<line ${segment} stroke="${paint}" stroke-width="1.2" fill="none" opacity="${opacity}" pointer-events="none" />`,
        )
        marks.push(
          `<line data-hit="true" ${segment} stroke="transparent" stroke-width="6" fill="none" pointer-events="stroke" />`,
        )
      }
      marks.push(
        `<circle data-date="${escapeAttribute(quote.date)}" data-price="${quote.sellingPrice}" data-code="${escapeAttribute(item.code)}" cx="${x}" cy="${y}" r="1.2" fill="${paint}" opacity="${opacity}" />`,
      )
      previous = { date: quote.date, price: quote.sellingPrice, x, y }
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
      `<text data-series-label="true" data-code="${escapeAttribute(label.code)}" data-focused="${label.focused}" x="${seriesNameX}" y="${y}" font-size="${style.fontSize}" fill="${label.paint}" opacity="${label.opacity}" dominant-baseline="middle">${escapeHtml(label.code)}</text>`,
    )
  }
  return marks.join("")
}

function lineSegments(view: View): string[] {
  const segments: string[] = []
  for (const item of view.series) {
    for (let index = 1; index < item.quotes.length; index += 1) {
      const previous = item.quotes[index - 1]
      const current = item.quotes[index]
      if (previous !== undefined && current !== undefined && addDays(previous.date, 1) === current.date) {
        segments.push(`${previous.date} ${current.date}`)
      }
    }
  }
  return segments
}

function keywordText(actions: readonly Action[]): string {
  let keyword = ""
  for (const action of actions) {
    if (action.type === "setKeyword") {
      keyword = action.text
    }
  }
  return keyword
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

export function renderPage(series: PriceSeries, actions: readonly Action[]): string {
  preparedBrandSvgs.clear()
  const view = present(series, actions)
  const keyword = escapeAttribute(keywordText(actions))
  const chipGroups = chipGroupNames(actions)
  const rangeStart = view.queryRange === null ? "" : view.queryRange.start
  const rangeEnd = view.queryRange === null ? "" : view.queryRange.end
  const candidates = view.candidates
    .map((code) => {
      const pressed = view.selected.includes(code) ? "true" : "false"
      return `<li>${buttonMarkup(code, { "aria-pressed": pressed })}</li>`
    })
    .join("")
  const selected = view.selected
    .map((code) => `<li><span>${escapeHtml(code)}</span>${buttonMarkup("拿掉", { "data-code": code })}</li>`)
    .join("")
  const priceAxis = view.axis === null
    ? ""
    : `<span>${view.axis.lower}</span><span>${view.axis.upper}</span>`
  const axis = axisDates(view).map((date) => `<span>${escapeHtml(date)}</span>`).join("")
  const segments = lineSegments(view).map((segment) => `<span>${escapeHtml(segment)}</span>`).join("")
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <body>
    <div class="p-4 md:p-6">
    <section class="flex flex-col gap-3 text-sm">
      <h2>篩選</h2>
      <label>起日 <input type="date" aria-label="起日" value="${escapeAttribute(rangeStart)}"></label>
      <label>迄日 <input type="date" aria-label="迄日" value="${escapeAttribute(rangeEnd)}"></label>
      <label>晶片分組 ${chipVendorMarkup()}${chipGroupMarkup(view.chipGroups, chipGroups)}</label>
      <label>關鍵字 ${keywordMarkup(keyword)}</label>
      ${buttonMarkup("搜尋", { "aria-label": "搜尋" })}
      <ul aria-label="候選">${candidates}</ul>
      <p>已選</p>
      <ul aria-label="已選">${selected}</ul>
    </section>
    <section class="flex flex-col gap-3 text-sm">
      <h2>價格序列</h2>
      <div aria-label="日期軸">${axis}</div>
      <div aria-label="金額軸">${priceAxis}</div>
      <div aria-label="折線">${segments}</div>
      ${chartSvg(chartMarks(view), "折線圖")}
    </section>
    ${view.modelCharts.map((chart) => modelSection(view, chart)).join("")}
    </div>
  </body>
</html>`
}

function modelSvg(
  view: View,
  lines: readonly { code: string; brand: string; quotes: readonly { date: string; sellingPrice: number }[] }[],
  focus: string,
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
    selected: [],
    series,
    axis: priceBounds(series),
    readout: null,
    modelCharts: [],
  }, true, focus))
}

function modelSection(view: View, chart: View["modelCharts"][number]): string {
  const stored = new Map<string, string>()
  stored.set("", modelSvg(view, chart.allSeries, ""))
  for (const name of chart.brands) {
    stored.set(name, modelSvg(view, chart.allSeries.filter((line) => line.brand === name), ""))
  }
  preparedBrandSvgs.set(chart.group, stored)
  const visibleLines = chart.brand === ""
    ? chart.allSeries
    : chart.allSeries.filter((line) => line.brand === chart.brand)
  const brands = brandMarkup(chart.brands, chart.brand)
  return `<section class="flex flex-col gap-2 text-sm" aria-label="${escapeAttribute(chart.group)}"><h3 class="font-medium">${escapeHtml(chart.group)}</h3><div aria-label="品牌" class="flex flex-wrap gap-2">${brands}</div>${modelSvg(view, visibleLines, chart.focus)}</section>`
}

function priceBounds(
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
