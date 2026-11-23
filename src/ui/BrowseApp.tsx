import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import {
  fetchModelCatalog,
  fetchQuotesForGroups,
  fetchUsedForGroups,
  type ModelOption,
} from "../model-data.ts"
import { clearPreparedCharts, type ChartRange, type IndicatorWindow } from "../page.ts"
import {
  groupsMatchingRtxModel,
  present,
  rtxModelLabel,
  rtxModelLabels,
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

type ModelBundle = {
  quotes: PriceSeries["quotes"][number][]
  used: UsedPost[]
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
  const [modelCatalog, setModelCatalog] = useState<ModelOption[]>([])
  const [bundles, setBundles] = useState<Readonly<Record<string, ModelBundle>>>({})
  const bundlesRef = useRef(bundles)
  bundlesRef.current = bundles
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
  const fetchToken = useRef(0)

  const workingSeries = useMemo((): PriceSeries => {
    const labels = Object.keys(bundles)
    if (labels.length === 0) {
      return series
    }
    const quotes = series.quotes.map((quote) => quote)
    for (const label of labels) {
      const bundle = bundles[label]
      if (bundle === undefined) {
        continue
      }
      for (const quote of bundle.quotes) {
        if (!quotes.some((item) => item.code === quote.code && item.date === quote.date)) {
          quotes.push(quote)
        }
      }
    }
    return { quotes }
  }, [series, bundles])

  const workingUsed = useMemo((): readonly UsedPost[] => {
    const labels = Object.keys(bundles)
    if (labels.length === 0) {
      return usedPosts
    }
    const posts = usedPosts.map((post) => post)
    for (const label of labels) {
      const bundle = bundles[label]
      if (bundle === undefined) {
        continue
      }
      for (const post of bundle.used) {
        if (!posts.some((item) => item.link === post.link && item.code === post.code && item.price === post.price)) {
          posts.push(post)
        }
      }
    }
    return posts
  }, [usedPosts, bundles])

  const listView = useMemo(
    () => present(workingSeries, actions, workingUsed),
    [workingSeries, actions, workingUsed],
  )
  const chartsKey = chartActionKey(actions)
  const actionsRef = useRef(actions)
  actionsRef.current = actions
  const chartView = useMemo(() => {
    const chartActions = actionsRef.current.filter(
      (action) =>
        action.type !== "select" && action.type !== "deselect" && action.type !== "point",
    )
    return present(workingSeries, chartActions, workingUsed)
  }, [workingSeries, workingUsed, chartsKey])

  const progressive = workingSeries.quotes.length > chartQuoteLimit
  const brands = sharedBrandNames(chartView)
  const selectedBrands = chartView.modelCharts[0]?.selectedBrands ?? []
  const selectedChipGroups = appliedChipGroups(actions)
  const modelLabels =
    modelCatalog.length > 0
      ? modelCatalog.map((item) => item.label)
      : rtxModelLabels(listView.chipGroups)

  useEffect(() => {
    document.documentElement.lang = "zh-Hant"
  }, [])

  useEffect(() => {
    if (series.quotes.length > 0) {
      return
    }
    let cancelled = false
    setLoadingText("正在讀取型號清單")
    void fetchModelCatalog().then((models) => {
      if (cancelled) {
        return
      }
      setModelCatalog(models)
      setLoadingText("")
    })
    return () => {
      cancelled = true
    }
  }, [series.quotes.length])

  useEffect(() => {
    clearPreparedCharts()
    setVisibleCount(progressive ? 0 : Number.POSITIVE_INFINITY)
    if (Object.keys(bundles).length === 0 && series.quotes.length === 0 && modelCatalog.length === 0) {
      return
    }
    setLoadingText((text) => (text.startsWith("正在讀取") ? text : progressive ? "正在繪製圖表" : ""))
  }, [workingSeries, workingUsed, progressive, bundles, series.quotes.length, modelCatalog.length])

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

  const applyModelActions = (labels: readonly string[], groupSource: readonly string[]): void => {
    const base = actionsRef.current.filter(
      (action) => action.type !== "setChipGroup" && action.type !== "setGeneration",
    )
    if (labels.length === 0) {
      setActions(base)
      return
    }
    const nextGroups: string[] = []
    for (const name of labels) {
      for (const group of groupsMatchingRtxModel(groupSource, name)) {
        if (!nextGroups.includes(group)) {
          nextGroups.push(group)
        }
      }
    }
    setActions([
      ...base,
      ...nextGroups.map((group) => ({ type: "setChipGroup" as const, name: group })),
    ])
  }

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
    setDraftChips([])
    const currentGroups = appliedChipGroups(actionsRef.current)
    const currentLabels: string[] = []
    for (const group of currentGroups) {
      const name = rtxModelLabel(group)
      if (name !== null && !currentLabels.includes(name)) {
        currentLabels.push(name)
      }
    }
    const selected = currentLabels.includes(label)
    const nextLabels = selected
      ? currentLabels.filter((name) => name !== label)
      : [...currentLabels, label]

    if (selected) {
      const nextBundles = { ...bundlesRef.current }
      delete nextBundles[label]
      const remainingQuotes = Object.values(nextBundles).flatMap((bundle) => bundle.quotes)
      const groupSource =
        remainingQuotes.length > 0
          ? present({ quotes: remainingQuotes }, []).chipGroups
          : listView.chipGroups.filter((group) => rtxModelLabel(group) !== label)
      flushSync(() => {
        bundlesRef.current = nextBundles
        setBundles(nextBundles)
        applyModelActions(nextLabels, groupSource)
      })
      return
    }

    const catalog = modelCatalog.find((item) => item.label === label)
    const fetchGroups = catalog !== undefined
      ? [...catalog.groups]
      : groupsMatchingRtxModel(listView.chipGroups, label)

    if (catalog === undefined || series.quotes.length > 0) {
      flushSync(() => {
        applyModelActions(nextLabels, listView.chipGroups)
      })
      return
    }

    if (bundlesRef.current[label] !== undefined) {
      const groupSource = present(
        {
          quotes: Object.values(bundlesRef.current).flatMap((bundle) => bundle.quotes),
        },
        [],
      ).chipGroups
      flushSync(() => {
        applyModelActions(nextLabels, groupSource)
      })
      return
    }

    const token = fetchToken.current + 1
    fetchToken.current = token
    setLoadingText(`正在讀取 ${label}`)
    void Promise.all([fetchQuotesForGroups(fetchGroups), fetchUsedForGroups(fetchGroups)]).then(
      ([quotes, used]) => {
        if (fetchToken.current !== token) {
          return
        }
        const nextBundles = {
          ...bundlesRef.current,
          [label]: { quotes, used },
        }
        const groupSource = present(
          {
            quotes: Object.values(nextBundles).flatMap((bundle) => bundle.quotes),
          },
          [],
        ).chipGroups
        flushSync(() => {
          bundlesRef.current = nextBundles
          setBundles(nextBundles)
          applyModelActions(nextLabels, groupSource)
          setLoadingText("")
        })
      },
    )
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
        const selected = present(workingSeries, previous, workingUsed).selected
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
          modelLabels={modelLabels}
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
