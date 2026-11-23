import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { clearPreparedCharts, type ChartRange, type IndicatorWindow } from "../page.ts"
import {
  present,
  type Action,
  type Generation,
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
const generationNames: readonly Generation[] = ["30", "40", "50"]

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

function BrowseApp({
  series,
  usedPosts,
}: {
  series: PriceSeries
  usedPosts: readonly UsedPost[]
}): ReactNode {
  const [actions, setActions] = useState<Action[]>([])
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
  const [preparedGenerations, setPreparedGenerations] = useState<ReadonlySet<Generation>>(
    () => new Set(),
  )
  const [visibleCount, setVisibleCount] = useState(() =>
    series.quotes.length > chartQuoteLimit ? 0 : Number.POSITIVE_INFINITY,
  )
  const [loadingText, setLoadingText] = useState(
    series.quotes.length > chartQuoteLimit ? "正在繪製圖表" : "",
  )
  const startRef = useRef<HTMLInputElement | null>(null)
  const endRef = useRef<HTMLInputElement | null>(null)
  const lockRef = useRef<ChartLock>({ code: null, svg: null })
  const generationCache = useRef(
    new Map<Generation, { view: View; key: string }>(),
  )

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

  useEffect(() => {
    document.documentElement.lang = "zh-Hant"
  }, [])

  useEffect(() => {
    clearPreparedCharts()
    generationCache.current.clear()
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

  useEffect(() => {
    const shown = chartView.generation
    const base = actionsRef.current.filter(
      (action) => action.type !== "setChipGroup" && action.type !== "setGeneration",
    )
    const key = chartActionKey([...base, { type: "setGeneration", name: shown }])
    generationCache.current.set(shown, { view: chartView, key })
    setPreparedGenerations((previous) => {
      if (previous.has(shown)) {
        return previous
      }
      const next = new Set(previous)
      next.add(shown)
      return next
    })
    const queue = generationNames.filter((name) => name !== shown)
    let cancelled = false
    const load = (index: number): void => {
      if (cancelled) {
        return
      }
      const name = queue[index]
      if (name === undefined) {
        return
      }
      const view = present(series, [...base, { type: "setGeneration", name }], usedPosts)
      generationCache.current.set(name, {
        view,
        key: chartActionKey([...base, { type: "setGeneration", name }]),
      })
      setPreparedGenerations((previous) => {
        const next = new Set(previous)
        next.add(name)
        return next
      })
      setTimeout(() => {
        load(index + 1)
      }, 0)
    }
    setTimeout(() => {
      load(0)
    }, 0)
    return () => {
      cancelled = true
    }
  }, [chartView, series, usedPosts, chartsKey])

  const onSearch = (): void => {
    const start = startRef.current?.value ?? ""
    const end = endRef.current?.value ?? ""
    flushSync(() => {
      setActions((previous) => {
        const kept = previous.filter(
          (action) =>
            action.type !== "setKeyword"
            && action.type !== "setChipGroup"
            && action.type !== "setRange",
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

  const onGeneration = (name: Generation): void => {
    flushSync(() => {
      setDraftChips([])
      setActions((previous) => [
        ...previous.filter(
          (action) => action.type !== "setChipGroup" && action.type !== "setGeneration",
        ),
        { type: "setGeneration", name },
      ])
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
          vendor={vendor}
          preparedGenerations={preparedGenerations}
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
          onGeneration={onGeneration}
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
