import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { clearPreparedCharts, type ChartRange, type IndicatorWindow } from "../page.ts"
import {
  groupsMatchingRtxModel,
  present,
  rtxModelLabel,
  type Action,
  type PriceSeries,
  type View,
} from "../present.ts"
import type { UsedPost } from "../used-post.ts"
import { AppShell } from "./AppShell.tsx"
import { ChartSidebar } from "./ChartSidebar.tsx"
import { type ChartLock } from "./chartInteractions.ts"
import { FilterPanel } from "./FilterPanel.tsx"
import { ModelChartList } from "./ModelChartSection.tsx"

const chartQuoteLimit = 2000

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

function chartActionKey(actions: readonly Action[]): string {
  return actions
    .filter(
      (action) =>
        action.type !== "select" && action.type !== "deselect" && action.type !== "point",
    )
    .map((action) => JSON.stringify(action))
    .join("|")
}

function appliedChipGroups(actions: readonly Action[]): string[] {
  const names: string[] = []
  for (const action of actions) {
    if (action.type === "setChipGroup" && action.name !== "" && !names.includes(action.name)) {
      names.push(action.name)
    }
  }
  return names
}

function BrowseApp({
  series,
  usedPosts,
  initialActions = [],
}: {
  series: PriceSeries
  usedPosts: readonly UsedPost[]
  initialActions?: readonly Action[]
}): ReactNode {
  const [actions, setActions] = useState<Action[]>(() => [...initialActions])
  const [vendor, setVendor] = useState("NVIDIA")
  const [draftChips, setDraftChips] = useState<string[]>([])
  const [chartRange, setChartRange] = useState<ChartRange>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "3"
    }
    return "12"
  })
  const [indicator, setIndicator] = useState<IndicatorWindow>("month")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [visibleCount, setVisibleCount] = useState(() =>
    series.quotes.length > chartQuoteLimit ? 0 : Number.POSITIVE_INFINITY,
  )
  const [loadingText, setLoadingText] = useState(
    series.quotes.length > chartQuoteLimit ? "正在繪製圖表" : "",
  )
  const startRef = useRef<HTMLInputElement | null>(null)
  const endRef = useRef<HTMLInputElement | null>(null)
  const lockRef = useRef<ChartLock>({ code: null, svg: null })

  const listView = useMemo(() => present(series, actions, usedPosts), [series, actions, usedPosts])
  const chartsKey = chartActionKey(actions)
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const chartView = useMemo(() => {
    const chartActions = actionsRef.current.filter(
      (action) =>
        action.type !== "select" && action.type !== "deselect" && action.type !== "point",
    )
    return present(series, chartActions, usedPosts)
  }, [series, usedPosts, chartsKey])

  const progressive = series.quotes.length > chartQuoteLimit
  const brands = sharedBrandNames(chartView)
  const selectedBrands = chartView.modelCharts[0]?.selectedBrands ?? []
  const selectedChipGroups = appliedChipGroups(actions)

  useEffect(() => {
    document.documentElement.lang = "zh-Hant"
  }, [])

  useEffect(() => {
    clearPreparedCharts()
    setVisibleCount(progressive ? 0 : Number.POSITIVE_INFINITY)
    setLoadingText(progressive ? "正在繪製圖表" : "")
  }, [series, usedPosts, progressive])

  useEffect(() => {
    if (!progressive) {
      return
    }
    const total = chartView.modelCharts.length
    if (visibleCount >= total) {
      setLoadingText("")
      return
    }
    setLoadingText(`正在繪製圖表 ${visibleCount + 1}/${total}`)
    const timer = setTimeout(() => {
      setVisibleCount((count) => Math.min(total, count + 1))
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [progressive, visibleCount, chartView.modelCharts.length])

  const onSearch = (): void => {
    const start = startRef.current?.value ?? ""
    const end = endRef.current?.value ?? ""
    flushSync(() => {
      setActions((previous) => {
        const kept = previous.filter(
          (action) =>
            action.type !== "setKeyword"
            && action.type !== "setChipGroup"
            && action.type !== "setRange"
            && action.type !== "setGeneration",
        )
        const next: Action[] = [...kept, { type: "setKeyword", text: "" }]
        for (const name of draftChips) {
          next.push({ type: "setChipGroup", name })
        }
        if (start !== "" && end !== "") {
          next.push({ type: "setRange", start, end })
        }
        return next
      })
    })
  }

  const onToggleModel = (label: string): void => {
    flushSync(() => {
      setDraftChips([])
      setActions((previous) => {
        const currentGroups = appliedChipGroups(previous)
        const currentLabels: string[] = []
        for (const group of currentGroups) {
          const name = rtxModelLabel(group)
          if (name !== null && !currentLabels.includes(name)) {
            currentLabels.push(name)
          }
        }
        const nextLabels = currentLabels.includes(label)
          ? currentLabels.filter((name) => name !== label)
          : [...currentLabels, label]
        const base = previous.filter(
          (action) => action.type !== "setChipGroup" && action.type !== "setGeneration",
        )
        if (nextLabels.length === 0) {
          return base
        }
        const nextGroups: string[] = []
        for (const name of nextLabels) {
          for (const group of groupsMatchingRtxModel(listView.chipGroups, name)) {
            if (!nextGroups.includes(group)) {
              nextGroups.push(group)
            }
          }
        }
        return [
          ...base,
          ...nextGroups.map((group) => ({ type: "setChipGroup" as const, name: group })),
        ]
      })
    })
  }

  const onBrand = (name: string): void => {
    flushSync(() => {
      setActions((previous) => {
        const current = previous
          .filter((action) => action.type === "setBrand")
          .map((action) => (action.type === "setBrand" ? action.name : ""))
          .filter((text) => text !== "")
        const nextNames = current.includes(name)
          ? current.filter((item) => item !== name)
          : [...current, name]
        return [
          ...previous.filter((action) => action.type !== "setBrand" && action.type !== "setFocus"),
          ...nextNames.map((brand) => ({ type: "setBrand" as const, group: "", name: brand })),
        ]
      })
    })
  }

  const onOnSale = (): void => {
    flushSync(() => {
      setActions((previous) => {
        const on = !previous.some((action) => action.type === "setOnSale" && action.on)
        const without = previous.filter((action) => action.type !== "setOnSale")
        return on ? [...without, { type: "setOnSale", on: true }] : without
      })
    })
  }

  const onSelectCode = (code: string): void => {
    flushSync(() => {
      setActions((previous) => {
        const selected = present(series, previous, usedPosts).selected
        const type: "select" | "deselect" = selected.includes(code) ? "deselect" : "select"
        return [...previous, { type, code }]
      })
    })
  }

  const onRemoveCode = (code: string): void => {
    flushSync(() => {
      setActions((previous) => [...previous, { type: "deselect", code }])
    })
  }

  const chartCount =
    progressive && Number.isFinite(visibleCount)
      ? visibleCount
      : chartView.modelCharts.length

  return (
    <AppShell
      sidebar={
        <ChartSidebar
          brands={brands}
          selectedBrands={selectedBrands}
          onSaleOnly={chartView.onSaleOnly}
          chartRange={chartRange}
          indicator={indicator}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            flushSync(() => {
              setSidebarCollapsed((value) => !value)
            })
          }}
          onRange={(mode) => {
            flushSync(() => {
              setChartRange(mode)
            })
          }}
          onIndicator={(window) => {
            flushSync(() => {
              setIndicator(window)
            })
          }}
          onOnSale={onOnSale}
          onBrand={onBrand}
        />
      }
      filter={
        <FilterPanel
          view={listView}
          chipGroups={draftChips}
          appliedChipGroups={selectedChipGroups}
          vendor={vendor}
          startRef={startRef}
          endRef={endRef}
          onVendor={(name) => {
            flushSync(() => {
              setVendor(name)
            })
          }}
          onToggleChip={(name) => {
            flushSync(() => {
              setDraftChips((previous) =>
                previous.includes(name)
                  ? previous.filter((item) => item !== name)
                  : [...previous, name],
              )
            })
          }}
          onToggleModel={onToggleModel}
          onSearch={onSearch}
          onSelectCode={onSelectCode}
          onRemoveCode={onRemoveCode}
        />
      }
      loading={
        loadingText === "" ? null : (
          <p data-loading="" aria-live="polite" className="mb-4 text-sm text-ink-muted">
            {loadingText}
          </p>
        )
      }
      charts={
        <ModelChartList
          view={chartView}
          chartRange={chartRange}
          indicator={indicator}
          lock={lockRef.current}
          progressive={progressive}
          visibleCount={chartCount}
        />
      }
    />
  )
}

export { BrowseApp, chartQuoteLimit }
