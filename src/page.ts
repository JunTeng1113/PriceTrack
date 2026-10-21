import { brandMarkup, buttonMarkup, chipGroupMarkup, keywordMarkup } from "./fields.tsx"
import { present, type Action, type PriceSeries, type View } from "./present.ts"

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

function chartMarks(view: View, connectGaps = false): string {
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
  const priceSpan = axis.upper - axis.lower
  const marks: string[] = []
  const laneCount = view.series.length
  for (const [seriesIndex, item] of view.series.entries()) {
    const quoted = new Set(item.quotes.map((quote) => quote.date))
    const band = 100 / laneCount
    for (const date of dates) {
      if (quoted.has(date)) {
        continue
      }
      const x = daySpan === 0 ? 50 : ((dayNumber(date) - startDay) / daySpan) * 100
      marks.push(
        `<rect data-day="${escapeAttribute(date)}" data-code="${escapeAttribute(item.code)}" x="${x - 1}" y="${seriesIndex * band}" width="2" height="${band}" fill="transparent" />`,
      )
    }
    const paint = connectGaps ? seriesColor(seriesIndex) : "currentColor"
    let previous: { date: string; x: number; y: number } | null = null
    for (const quote of item.quotes) {
      const x = daySpan === 0 ? 50 : ((dayNumber(quote.date) - startDay) / daySpan) * 100
      const y = priceSpan === 0 ? 50 : 100 - ((quote.sellingPrice - axis.lower) / priceSpan) * 100
      if (previous !== null && (connectGaps || addDays(previous.date, 1) === quote.date)) {
        marks.push(
          `<line data-code="${escapeAttribute(item.code)}" x1="${previous.x}" y1="${previous.y}" x2="${x}" y2="${y}" stroke="${paint}" stroke-width="0.6" fill="none" />`,
        )
      }
      marks.push(
        `<circle data-date="${escapeAttribute(quote.date)}" data-price="${quote.sellingPrice}" data-code="${escapeAttribute(item.code)}" cx="${x}" cy="${y}" r="1.2" fill="${paint}" />`,
      )
      previous = { date: quote.date, x, y }
    }
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

function chipGroupName(actions: readonly Action[]): string {
  let name = ""
  for (const action of actions) {
    if (action.type === "setChipGroup") {
      name = action.name
    }
  }
  return name
}

export function renderPage(series: PriceSeries, actions: readonly Action[]): string {
  const view = present(series, actions)
  const keyword = escapeAttribute(keywordText(actions))
  const chipGroup = chipGroupName(actions)
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
  const points = view.series.flatMap((item) =>
    item.quotes.map((quote) =>
      `<li><button type="button" data-date="${escapeAttribute(quote.date)}" data-code="${escapeAttribute(item.code)}">${escapeHtml(quote.date)} ${escapeHtml(item.code)} ${quote.sellingPrice}</button></li>`,
    ),
  ).join("")
  const priceAxis = view.axis === null
    ? ""
    : `<span>${view.axis.lower}</span><span>${view.axis.upper}</span>`
  const readout = view.readout === null
    ? ""
    : `${escapeHtml(view.readout.date)} ${escapeHtml(view.readout.code)} ${view.readout.sellingPrice}`
  const axis = axisDates(view).map((date) => `<span>${escapeHtml(date)}</span>`).join("")
  const segments = lineSegments(view).map((segment) => `<span>${escapeHtml(segment)}</span>`).join("")
  return `<!DOCTYPE html>
<html lang="zh-Hant">
  <body>
    <section class="flex flex-col gap-3 text-sm">
      <h2>篩選</h2>
      <label>起日 <input type="date" aria-label="起日" value="${escapeAttribute(rangeStart)}"></label>
      <label>迄日 <input type="date" aria-label="迄日" value="${escapeAttribute(rangeEnd)}"></label>
      <label>晶片分組 ${chipGroupMarkup(view.chipGroups, chipGroup)}</label>
      <label>關鍵字 ${keywordMarkup(keyword)}</label>
      <ul aria-label="候選">${candidates}</ul>
      <p>已選</p>
      <ul aria-label="已選">${selected}</ul>
    </section>
    <section class="flex flex-col gap-3 text-sm">
      <h2>價格序列</h2>
      <div aria-label="日期軸">${axis}</div>
      <div aria-label="金額軸">${priceAxis}</div>
      <div aria-label="折線">${segments}</div>
      <svg aria-label="折線圖" viewBox="0 0 100 100" width="100%" height="240">${chartMarks(view)}</svg>
      <ul aria-label="圖例">${view.series.map((item) => `<li>${escapeHtml(item.code)}</li>`).join("")}</ul>
      <p aria-label="讀數">${readout}</p>
      <ul aria-label="價格點">${points}</ul>
    </section>
    ${modelSection(view)}
  </body>
</html>`
}

function modelSection(view: View): string {
  const chart = view.modelChart
  if (chart === null) {
    return ""
  }
  const legend = chart.series.map((item, index) =>
    `<li><span style="background:${seriesColor(index)}"></span>${escapeHtml(item.code)}</li>`,
  ).join("")
  const points = chart.series.flatMap((item) =>
    item.quotes.map((quote) =>
      `<li>${escapeHtml(quote.date)} ${escapeHtml(item.code)} ${quote.sellingPrice}</li>`,
    ),
  ).join("")
  const marks = chartMarks({
    queryRange: view.queryRange,
    chipGroups: [],
    candidates: [],
    selected: [],
    series: chart.series,
    axis: priceBounds(chart.series),
    readout: null,
    modelChart: null,
  }, true)
  const brands = brandMarkup(chart.brands, chart.brand)
  const readout = chart.readout === null
    ? ""
    : `${escapeHtml(chart.readout.date)} ${escapeHtml(chart.readout.code)} ${chart.readout.sellingPrice}`
  return `<section aria-label="${escapeAttribute(chart.group)}"><label>品牌 ${brands}</label><ul aria-label="圖例">${legend}</ul><ul>${points}</ul><svg>${marks}</svg><p aria-label="讀數">${readout}</p></section>`
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
  const span = max - min
  const pad = span === 0 ? Math.max(1, Math.floor(min / 10)) : span / 10
  let lower = min - pad
  const upper = max + pad
  if (min > 0 && lower <= 0) {
    lower = min / 2
  }
  return { lower, upper }
}
