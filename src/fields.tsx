import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./components/ui/button.tsx"
import { ChipGroupSelect, chipVendors } from "./components/ui/select.tsx"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table.tsx"
import { brandColor, type Generation } from "./present.ts"

export function buttonMarkup(
  label: ReactNode,
  props: { "aria-pressed"?: "true" | "false"; "data-code"?: string; "aria-label"?: string },
): string {
  return renderToStaticMarkup(createElement(Button, props, label))
}

export function generationMarkup(selected: Generation | ""): string {
  const names: readonly Generation[] = ["30", "40", "50"]
  const buttons = names
    .map((name) => buttonMarkup(`${name}系列`, { "aria-pressed": name === selected ? "true" : "false" }))
    .join("")
  return `<div aria-label="世代" class="flex flex-wrap gap-2">${buttons}</div>`
}

export function chipVendorMarkup(): string {
  const buttons = chipVendors
    .map((name, index) => buttonMarkup(name, { "aria-pressed": index === 0 ? "true" : "false" }))
    .join("")
  return `<div aria-label="晶片廠" class="mb-4 flex flex-wrap gap-2">${buttons}</div>`
}

export function chipGroupMarkup(groups: readonly string[], selected: readonly string[]): string {
  return renderToStaticMarkup(createElement(ChipGroupSelect, { groups, selected }))
}

export function listingTableMarkup(
  rows: readonly { code: string; price: string; date: string; pressed: boolean }[],
): string {
  if (rows.length === 0) {
    return ""
  }
  return renderToStaticMarkup(
    createElement(
      Table,
      { "aria-label": "候選" },
      createElement(
        TableHeader,
        null,
        createElement(
          TableRow,
          null,
          createElement(TableHead, null, "型號名稱"),
          createElement(TableHead, { className: "text-right" }, "價格"),
          createElement(TableHead, null, "日期"),
        ),
      ),
      createElement(
        TableBody,
        null,
        rows.map((row) =>
          createElement(
            TableRow,
            { key: row.code },
            createElement(
              TableCell,
              { className: "whitespace-normal font-medium" },
              createElement(Button, { "aria-pressed": row.pressed ? "true" : "false" }, row.code),
            ),
            createElement(TableCell, { className: "text-right" }, row.price),
            createElement(TableCell, null, row.date),
          ),
        ),
      ),
    ),
  )
}

export function brandMarkup(brands: readonly string[], selected: readonly string[]): string {
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
      return buttonMarkup(label, { "aria-pressed": selected.includes(name) ? "true" : "false" })
    })
    .join("")
}
