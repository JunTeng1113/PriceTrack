import type { ComponentProps } from "react"
import { cn } from "../../lib/utils.ts"

function Button({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-ink transition-colors",
        "hover:bg-surface",
        "aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white",
        "aria-pressed:bg-slate-900 aria-pressed:border-slate-900",
        className,
      )}
      {...props}
    />
  )
}

export { Button }
