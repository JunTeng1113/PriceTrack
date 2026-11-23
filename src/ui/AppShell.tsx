import type { ReactNode } from "react"
import { cn } from "../lib/utils.ts"

function AppShell({
  sidebar,
  filter,
  charts,
  loading,
}: {
  sidebar: ReactNode
  filter: ReactNode
  charts: ReactNode
  loading?: ReactNode
}): ReactNode {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row md:items-start">
      {sidebar}
      <div className="min-w-0 flex-1 p-4 md:p-6">
        {filter}
        {loading}
        {charts}
      </div>
    </div>
  )
}

function MobileControls({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}): ReactNode {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised p-4 shadow-lg md:hidden",
        open ? "" : "hidden",
      )}
      role="dialog"
      aria-label="圖表控制"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">圖表控制</p>
        <button type="button" className="text-sm text-ink-muted" onClick={onClose}>
          關閉
        </button>
      </div>
      <div className="max-h-[50dvh] overflow-y-auto">{children}</div>
    </div>
  )
}

export { AppShell, MobileControls }
