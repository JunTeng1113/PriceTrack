import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./components/ui/button.tsx"
import { ChipGroupSelect, chipVendors } from "./components/ui/select.tsx"
import { Input } from "./components/ui/input.tsx"
import { brandColor } from "./present.ts"

export function keywordMarkup(value: string): string {
  return renderToStaticMarkup(createElement(Input, { "aria-label": "關鍵字", defaultValue: value }))
}

export function buttonMarkup(
  label: ReactNode,
  props: { "aria-pressed"?: "true" | "false"; "data-code"?: string; "aria-label"?: string },
): string {
  return renderToStaticMarkup(createElement(Button, props, label))
}

export function chipVendorMarkup(): string {
  const buttons = chipVendors
    .map((name) => buttonMarkup(name, { "aria-pressed": "false" }))
    .join("")
  return `<div aria-label="晶片廠" class="mb-2 flex flex-wrap gap-2">${buttons}</div>`
}

export function chipGroupMarkup(groups: readonly string[], selected: readonly string[]): string {
  return renderToStaticMarkup(createElement(ChipGroupSelect, { groups, selected }))
}

export function brandMarkup(brands: readonly string[], selected: string): string {
  return brands
    .map((name) => {
      const color = brandColor(name)
      const label = createElement(
        "span",
        { className: "inline-flex items-center gap-2" },
        createElement("span", {
          "aria-hidden": "true",
          className: "inline-block size-2.5 shrink-0 rounded-full",
          style: { backgroundColor: color },
        }),
        name,
      )
      return buttonMarkup(label, { "aria-pressed": name === selected ? "true" : "false" })
    })
    .join("")
}
