import type { ComponentProps, ReactNode } from "react"
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
        "border-input flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 text-sm",
        className,
      )}
      {...props}
    />
  )
}

function SelectContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="select-content"
      className={cn("hidden rounded-md border bg-background p-1", className)}
      {...props}
    />
  )
}

function SelectItem({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="option"
      data-slot="select-item"
      className={cn("cursor-pointer rounded-sm px-2 py-1.5 text-sm", className)}
      {...props}
    />
  )
}

function ChipGroupSelect({
  groups,
  selected,
  label = "晶片分組",
}: {
  groups: readonly string[]
  selected: string
  label?: string
}): ReactNode {
  return (
    <Select>
      <SelectTrigger aria-label={label}>{selected}</SelectTrigger>
      <SelectContent>
        {groups.map((name) => (
          <SelectItem key={name} data-value={name}>{name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { ChipGroupSelect }
