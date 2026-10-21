import type { ComponentProps } from "react"
import { cn } from "../../lib/utils.ts"

function Button({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium aria-pressed:border-slate-900 aria-pressed:bg-slate-900 aria-pressed:text-white",
        className,
      )}
      {...props}
    />
  )
}

export { Button }
