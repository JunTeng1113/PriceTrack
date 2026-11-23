import { memo, useLayoutEffect, useRef, type ReactNode } from "react"
import {
  adoptChartMark,
  applyChartMode,
  applyIndicator,
  chartCacheKey,
  modelSection,
  renderBrandSvg,
  restoreAxis,
  storeBrandChart,
  usedMarkup,
  visibleChart,
  type ChartRange,
  type IndicatorWindow,
} from "../page.ts"
import type { View } from "../present.ts"
import { bindChartsIn, isSvg, rebindChart, type ChartLock } from "./chartInteractions.ts"
import { VisibleHost } from "./VisibleHost.tsx"

const markBatch = 1200

function chartPaintKey(view: View, chart: View["modelCharts"][number]): string {
  const brands = chartCacheKey(chart.selectedBrands, view.onSaleOnly)
  const focus = chart.focus
  const marks = chart.series
    .map((line) => `${line.code}:${line.quotes.length}:${line.quotes.at(-1)?.sellingPrice ?? ""}`)
    .join("|")
  return `${chart.group}\0${brands}\0${focus}\0${marks}`
}

function paintUsed(section: Element, markup: string): void {
  const existing = section.querySelector("[data-used]")
  if (markup === "") {
    existing?.remove()
    return
  }
  const parsed = new DOMParser().parseFromString(markup, "text/html")
  const next = parsed.body.querySelector("[data-used]") ?? parsed.querySelector("[data-used]")
  if (next === null) {
    return
  }
  if (existing === null) {
    section.append(next)
  } else {
    existing.replaceWith(next)
  }
}

function swapBrandChart(
  section: Element,
  view: View,
  chart: View["modelCharts"][number],
  chartRange: ChartRange,
  indicator: IndicatorWindow,
  lock: ChartLock,
): boolean {
  const markup = renderBrandSvg(view, chart.group, chart.selectedBrands, view.onSaleOnly)
  if (markup === null) {
    return false
  }
  const parsed = new DOMParser().parseFromString(markup, "text/html")
  const nextSvg = parsed.querySelector("svg")
  const current = section.querySelector("svg[data-price-chart]")
  if (!isSvg(nextSvg) || !isSvg(current)) {
    return false
  }
  if (lock.svg === current) {
    lock.code = null
    lock.svg = null
  }
  restoreAxis(current)
  current.replaceWith(nextSvg)
  applyChartMode(nextSvg, chartRange)
  rebindChart(nextSvg, lock)
  paintUsed(section, usedMarkup(view, chart.group, chart.selectedBrands, view.onSaleOnly))
  applyIndicator(section, indicator)
  return true
}

function ModelChartSection({
  view,
  chart,
  chartRange,
  indicator,
  lock,
  progressive,
}: {
  view: View
  chart: View["modelCharts"][number]
  chartRange: ChartRange
  indicator: IndicatorWindow
  lock: ChartLock
  progressive: boolean
}): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null)
  const paintedRef = useRef(false)
  const paintKey = chartPaintKey(view, chart)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (host === null) {
      return
    }
    const existingSection = [...host.querySelectorAll("section")].find(
      (section) => section.getAttribute("aria-label") === chart.group,
    )
    if (existingSection !== undefined && paintedRef.current) {
      if (swapBrandChart(existingSection, view, chart, chartRange, indicator, lock)) {
        return
      }
    }

    lock.code = null
    lock.svg = null
    paintedRef.current = false

    if (!progressive) {
      host.innerHTML = modelSection(view, chart)
      const section = host.querySelector("section")
      if (section !== null) {
        for (const svg of section.querySelectorAll("svg[data-price-chart], svg[data-trend-chart]")) {
          if (isSvg(svg)) {
            applyChartMode(svg, chartRange)
          }
        }
        applyIndicator(section, indicator)
        bindChartsIn(section, lock)
        const price = section.querySelector("svg[data-price-chart]")
        if (isSvg(price) && (price.getAttribute("data-mode") ?? "fit") === "fit") {
          storeBrandChart(chart.group, chartCacheKey(chart.selectedBrands, view.onSaleOnly), price.outerHTML)
        }
      }
      paintedRef.current = true
      return
    }

    const piece = visibleChart(view, chart)
    host.innerHTML = piece.section
    const section = host.querySelector("section")
    const svg = section?.querySelector("svg[data-price-chart]") ?? null
    if (section === null || !isSvg(svg)) {
      return
    }
    let cancelled = false
    const pump = (offset: number): void => {
      if (cancelled || !svg.isConnected) {
        return
      }
      const slice = piece.marks.slice(offset, offset + markBatch).join("")
      if (slice !== "") {
        const parsedMarks = new DOMParser().parseFromString(
          `<svg xmlns="http://www.w3.org/2000/svg">${slice}</svg>`,
          "image/svg+xml",
        )
        const root = parsedMarks.documentElement
        if (root.namespaceURI === "http://www.w3.org/2000/svg" && root.localName !== "parsererror") {
          while (root.firstChild !== null) {
            const child = root.firstChild
            svg.append(child)
            if (child instanceof Element) {
              adoptChartMark(svg, child)
            }
          }
        }
      }
      if (offset + markBatch < piece.marks.length) {
        setTimeout(() => {
          pump(offset + markBatch)
        }, 0)
        return
      }
      applyChartMode(svg, chartRange)
      applyIndicator(section, indicator)
      bindChartsIn(section, lock)
      if ((svg.getAttribute("data-mode") ?? "fit") === "fit") {
        storeBrandChart(chart.group, chartCacheKey(chart.selectedBrands, view.onSaleOnly), svg.outerHTML)
      }
      paintedRef.current = true
    }
    pump(0)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey, progressive])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (host === null || !paintedRef.current) {
      return
    }
    for (const svg of host.querySelectorAll("svg[data-price-chart], svg[data-trend-chart]")) {
      if (isSvg(svg)) {
        applyChartMode(svg, chartRange)
        rebindChart(svg, lock)
      }
    }
  }, [chartRange, lock, paintKey])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (host === null || !paintedRef.current) {
      return
    }
    applyIndicator(host, indicator)
  }, [indicator, paintKey])

  return <div ref={hostRef} className="contents" data-chart-host={chart.group} />
}

const MemoModelChartSection = memo(ModelChartSection)

function ModelChartList({
  view,
  chartRange,
  indicator,
  lock,
  progressive,
  visibleCount,
}: {
  view: View
  chartRange: ChartRange
  indicator: IndicatorWindow
  lock: ChartLock
  progressive: boolean
  visibleCount: number
}): ReactNode {
  const charts = view.modelCharts.slice(0, visibleCount)
  const testEnv = import.meta.env.MODE === "test"
  const eagerCount = progressive ? charts.length : Math.min(2, charts.length)
  return (
    <>
      {charts.map((item, index) => (
        <VisibleHost key={item.group} eager={testEnv || index < eagerCount || progressive}>
          <MemoModelChartSection
            view={view}
            chart={item}
            chartRange={chartRange}
            indicator={indicator}
            lock={lock}
            progressive={progressive}
          />
        </VisibleHost>
      ))}
    </>
  )
}

export { ModelChartList }
