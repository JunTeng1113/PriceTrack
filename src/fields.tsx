import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./components/ui/button.tsx"
import { ChipGroupSelect } from "./components/ui/select.tsx"
import { Input } from "./components/ui/input.tsx"

export function keywordMarkup(value: string): string {
  return renderToStaticMarkup(createElement(Input, { "aria-label": "關鍵字", defaultValue: value }))
}

export function buttonMarkup(label: ReactNode, props: { "aria-pressed"?: "true" | "false"; "data-code"?: string }): string {
  return renderToStaticMarkup(createElement(Button, props, label))
}

export function chipGroupMarkup(groups: readonly string[], selected: string): string {
  return renderToStaticMarkup(createElement(ChipGroupSelect, { groups, selected }))
}

export function brandMarkup(brands: readonly string[], selected: string): string {
  return brands
    .map((name) => buttonMarkup(name, { "aria-pressed": name === selected ? "true" : "false" }))
    .join("")
}
