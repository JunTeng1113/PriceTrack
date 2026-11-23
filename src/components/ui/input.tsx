import { forwardRef, type ComponentProps } from "react"
import { cn } from "../../lib/utils.ts"

const Input = forwardRef<HTMLInputElement, ComponentProps<"input">>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "border-line flex h-9 w-full rounded-md border bg-surface-raised px-3 text-sm text-ink outline-none",
        "focus-visible:border-accent md:text-sm",
        className,
      )}
      {...props}
    />
  )
})

export { Input }
