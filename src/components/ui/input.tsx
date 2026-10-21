import type { ComponentProps } from "react"
import { cn } from "../../lib/utils.ts"

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
