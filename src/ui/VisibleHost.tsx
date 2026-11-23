import { useEffect, useRef, useState, type ReactNode } from "react"

function VisibleHost({
  children,
  eager = false,
  minHeightClass = "min-h-48",
}: {
  children: ReactNode
  eager?: boolean
  minHeightClass?: string
}): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(
    () => eager || typeof IntersectionObserver === "undefined",
  )

  useEffect(() => {
    if (visible || eager) {
      return
    }
    const node = hostRef.current
    if (node === null) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "240px 0px" },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [visible, eager])

  return (
    <div ref={hostRef} className={visible ? undefined : minHeightClass}>
      {visible ? children : <div className={minHeightClass} aria-hidden="true" />}
    </div>
  )
}

export { VisibleHost }
