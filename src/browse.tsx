import { createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { flushSync } from "react-dom"
import { BrowseApp } from "./ui/BrowseApp.tsx"
import type { Action, PriceSeries } from "./present.ts"
import type { UsedPost } from "./used-post.ts"

let root: Root | null = null
let seriesState: PriceSeries = { quotes: [] }
let usedState: readonly UsedPost[] = []
let actionsState: readonly Action[] = []
let revision = 0

function mountHost(): HTMLElement {
  document.documentElement.lang = "zh-Hant"
  const existing = document.getElementById("app")
  if (existing instanceof HTMLElement) {
    return existing
  }
  document.body.replaceChildren()
  const host = document.createElement("div")
  host.id = "app"
  document.body.append(host)
  return host
}

function renderApp(): void {
  const host = mountHost()
  if (root === null) {
    root = createRoot(host)
  }
  revision += 1
  flushSync(() => {
    root?.render(
      createElement(BrowseApp, {
        key: revision,
        series: seriesState,
        usedPosts: usedState,
        initialActions: actionsState,
      }),
    )
  })
}

export function start(series: PriceSeries, actions: readonly Action[] = []): {
  setSeries(next: PriceSeries): void
  setUsedPosts(next: readonly UsedPost[]): void
} {
  seriesState = series
  usedState = []
  actionsState = actions
  renderApp()
  return {
    setSeries(next: PriceSeries): void {
      seriesState = next
      renderApp()
    },
    setUsedPosts(next: readonly UsedPost[]): void {
      usedState = next
      if (seriesState.quotes.length > 0) {
        renderApp()
      }
    },
  }
}
