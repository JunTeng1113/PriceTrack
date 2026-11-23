import { forwardRef, useRef, type ComponentProps, type ReactNode } from "react"
import { cn } from "../../lib/utils.ts"

function Select({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="select" className={cn("grid gap-1", className)} {...props} />
}

function SelectTrigger({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      data-slot="select-trigger"
      className={cn(
        "border-line flex h-9 w-full items-center justify-between rounded-md border bg-surface-raised px-3 text-sm text-ink",
        className,
      )}
      {...props}
    />
  )
}

const SelectContent = forwardRef<HTMLDivElement, ComponentProps<"div">>(function SelectContent(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="select-content"
      className={cn("rounded-md border border-line bg-surface-raised p-1", className)}
      {...props}
    />
  )
})

function SelectItem({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="option"
      data-slot="select-item"
      className={cn("cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-surface", className)}
      {...props}
    />
  )
}

const chipVendors = ["NVIDIA", "AMD", "INTEL"] as const

function chipVendor(group: string): string {
  const found = chipVendors.find((vendor) => group.startsWith(vendor))
  return found ?? ""
}

function ChipGroupSelect({
  groups,
  selected,
  vendor,
  label = "核心規格",
  onToggle,
}: {
  groups: readonly string[]
  selected: readonly string[]
  vendor: string
  label?: string
  onToggle: (name: string) => void
}): ReactNode {
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <Select>
      <SelectTrigger
        aria-label={label}
        onClick={() => {
          contentRef.current?.classList.toggle("hidden")
        }}
      >
        {selected.join("、")}
      </SelectTrigger>
      <SelectContent
        ref={contentRef}
        aria-multiselectable="true"
        className="hidden max-h-60 overflow-y-auto"
        role="listbox"
      >
        {groups.map((name) => {
          const itemVendor = chipVendor(name)
          const shown = vendor !== "" && itemVendor === vendor
          return (
            <SelectItem
              key={name}
              aria-selected={selected.includes(name)}
              className={cn(
                "aria-selected:bg-slate-100",
                shown ? "" : "hidden",
              )}
              data-value={name}
              data-vendor={itemVendor}
              onClick={() => {
                onToggle(name)
              }}
            >
              {name}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export { ChipGroupSelect, chipVendors, chipVendor }
