import type { ReactNode, RefObject } from "react"
import { Button } from "../components/ui/button.tsx"
import { Input } from "../components/ui/input.tsx"
import { ChipGroupSelect, chipVendors } from "../components/ui/select.tsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table.tsx"
import type { Generation, View } from "../present.ts"

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

function FilterPanel({
  view,
  chipGroups,
  vendor,
  preparedGenerations,
  startRef,
  endRef,
  onVendor,
  onToggleChip,
  onGeneration,
  onSearch,
  onSelectCode,
  onRemoveCode,
}: {
  view: View
  chipGroups: readonly string[]
  vendor: string
  preparedGenerations: ReadonlySet<Generation>
  startRef: RefObject<HTMLInputElement | null>
  endRef: RefObject<HTMLInputElement | null>
  onVendor: (name: string) => void
  onToggleChip: (name: string) => void
  onGeneration: (name: Generation) => void
  onSearch: () => void
  onSelectCode: (code: string) => void
  onRemoveCode: (code: string) => void
}): ReactNode {
  const generation = chipGroups.length === 0 ? view.generation : ""
  const names: readonly Generation[] = ["30", "40", "50"]
  const rangeStart = view.queryRange === null ? "" : view.queryRange.start
  const rangeEnd = view.queryRange === null ? "" : view.queryRange.end

  return (
    <section className="mb-6 flex flex-col gap-4 text-sm md:gap-6">
      <h2 className="font-semibold tracking-tight">篩選</h2>
      <div aria-label="世代" className="flex flex-wrap gap-2">
        {names.map((name) => (
          <Button
            key={name}
            aria-pressed={name === generation ? "true" : "false"}
            data-prepared={preparedGenerations.has(name) ? "true" : undefined}
            onClick={() => {
              onGeneration(name)
            }}
          >
            {`${name}系列`}
          </Button>
        ))}
      </div>
      <label className="flex flex-col gap-1 sm:max-w-xs">
        <span className="text-ink-muted">起日</span>
        <Input ref={startRef} type="date" aria-label="起日" defaultValue={rangeStart} />
      </label>
      <label className="flex flex-col gap-1 sm:max-w-xs">
        <span className="text-ink-muted">迄日</span>
        <Input ref={endRef} type="date" aria-label="迄日" defaultValue={rangeEnd} />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-ink-muted">核心規格</span>
        <div aria-label="晶片廠" className="mb-2 flex flex-wrap gap-2">
          {chipVendors.map((name) => (
            <Button
              key={name}
              aria-pressed={name === vendor ? "true" : "false"}
              onClick={() => {
                onVendor(name)
              }}
            >
              {name}
            </Button>
          ))}
        </div>
        <ChipGroupSelect
          groups={view.chipGroups}
          selected={chipGroups}
          vendor={vendor}
          onToggle={onToggleChip}
        />
      </div>
      <div>
        <Button aria-label="搜尋" onClick={onSearch}>
          搜尋
        </Button>
      </div>
      {view.listings.length > 0 ? (
        <details>
          <summary className="cursor-pointer font-medium">{`型號列表（${view.listings.length}）`}</summary>
          <Table aria-label="候選">
            <TableHeader>
              <TableRow>
                <TableHead>型號名稱</TableHead>
                <TableHead className="text-right">價格</TableHead>
                <TableHead>日期</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.listings.map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="whitespace-normal font-medium">
                    <Button
                      aria-pressed={view.selected.includes(row.code) ? "true" : "false"}
                      onClick={() => {
                        onSelectCode(row.code)
                      }}
                    >
                      {row.code}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">{formatSellingPrice(row.sellingPrice)}</TableCell>
                  <TableCell>{row.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      ) : null}
      <ul aria-label="已選" className="flex flex-col gap-2">
        {view.selected.map((code) => (
          <li key={code} className="flex flex-wrap items-center gap-2">
            <span>{code}</span>
            <Button
              data-code={code}
              onClick={() => {
                onRemoveCode(code)
              }}
            >
              拿掉
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export { FilterPanel }
