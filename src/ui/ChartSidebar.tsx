import type { ReactNode } from "react"
import { Button } from "../components/ui/button.tsx"
import { brandColor } from "../present.ts"
import {
  indicatorLabel,
  type ChartRange,
  type IndicatorWindow,
} from "../page.ts"
import { cn } from "../lib/utils.ts"

function ChartSidebar({
  brands,
  selectedBrands,
  onSaleOnly,
  chartRange,
  indicator,
  collapsed,
  className,
  onToggleCollapse,
  onRange,
  onIndicator,
  onOnSale,
  onBrand,
}: {
  brands: readonly string[]
  selectedBrands: readonly string[]
  onSaleOnly: boolean
  chartRange: ChartRange
  indicator: IndicatorWindow
  collapsed: boolean
  className?: string
  onToggleCollapse: () => void
  onRange: (mode: ChartRange) => void
  onIndicator: (window: IndicatorWindow) => void
  onOnSale: () => void
  onBrand: (name: string) => void
}): ReactNode {
  const rangeOptions: { label: string; mode: ChartRange }[] = [
    { label: "整張", mode: "fit" },
    { label: "12 個月", mode: "12" },
    { label: "6 個月", mode: "6" },
    { label: "3 個月", mode: "3" },
  ]
  const indicatorWindows: IndicatorWindow[] = ["month", "quarter", "hybrid"]
  const separator = <div role="separator" className="my-4 w-full border-t border-slate-300" />

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex h-dvh shrink-0 bg-white",
        "max-md:static max-md:h-auto max-md:w-full max-md:border-b max-md:border-line",
        className,
      )}
      aria-label="側邊欄"
    >
      <div className="flex h-full max-h-dvh w-full flex-col gap-2 overflow-y-auto px-3 py-3 [&_button]:whitespace-nowrap max-md:max-h-none">
        <Button
          aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
          aria-expanded={collapsed ? "false" : "true"}
          onClick={onToggleCollapse}
        >
          {collapsed ? "展開" : "收合"}
        </Button>
        <div data-sidebar-panel className={cn("flex flex-col gap-2", collapsed ? "hidden" : "")}>
          <div role="group" aria-label="圖表日期範圍" className="flex flex-col gap-2 max-md:flex-row max-md:flex-wrap">
            {rangeOptions.map((option) => (
              <Button
                key={option.mode}
                aria-label={option.label}
                aria-pressed={chartRange === option.mode ? "true" : "false"}
                onClick={() => {
                  onRange(option.mode)
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {separator}
          <div role="group" aria-label="指標" className="flex flex-col gap-2 max-md:flex-row max-md:flex-wrap">
            {indicatorWindows.map((window) => (
              <Button
                key={window}
                aria-label={indicatorLabel(window)}
                aria-pressed={indicator === window ? "true" : "false"}
                onClick={() => {
                  onIndicator(window)
                }}
              >
                {indicatorLabel(window)}
              </Button>
            ))}
          </div>
          {separator}
          <Button
            aria-label="僅顯示在售"
            aria-pressed={onSaleOnly ? "true" : "false"}
            onClick={onOnSale}
          >
            僅顯示在售
          </Button>
          <div aria-label="品牌" className="flex flex-col gap-2 max-md:flex-row max-md:flex-wrap">
            {brands.map((name) => (
              <Button
                key={name}
                aria-pressed={selectedBrands.includes(name) ? "true" : "false"}
                onClick={() => {
                  onBrand(name)
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: brandColor(name) }}
                  />
                  {name}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

export { ChartSidebar }
