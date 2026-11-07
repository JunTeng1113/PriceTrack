import "./index.css"
import { start } from "./browse.ts"
import { readThroughCache } from "./cached-fetch.ts"
import { demoSeries } from "./main.ts"
import { emptySeries, type PriceSeries } from "./present.ts"
import { isQuote } from "./quote.ts"
import { usedPostsFrom, type UsedPost } from "./used-post.ts"

const session = start(emptySeries())
const quotes: PriceSeries["quotes"][number][] = []
let seriesReady = false
let usedReady = false
let nextSeries: PriceSeries = demoSeries()
let nextPosts: readonly UsedPost[] = []

function publish(): void {
  if (!seriesReady || !usedReady) {
    return
  }
  session.setUsedPosts(nextPosts)
  session.setSeries(nextSeries)
}

function showProgress(text: string): void {
  const existing = document.querySelector("[data-loading]")
  if (existing instanceof HTMLElement) {
    existing.textContent = text
    return
  }
  const section = document.querySelector("section")
  if (section === null) {
    return
  }
  const created = document.createElement("p")
  created.setAttribute("data-loading", "")
  created.setAttribute("aria-live", "polite")
  created.textContent = text
  section.append(created)
}

showProgress("正在讀取報價")

const worker = new Worker(new URL("./series-worker.ts", import.meta.url), { type: "module" })

worker.addEventListener("message", (event: MessageEvent<unknown>) => {
  const data = event.data
  if (typeof data !== "object" || data === null || !("type" in data) || typeof data.type !== "string") {
    return
  }
  if (data.type === "reset") {
    quotes.length = 0
    return
  }
  if (data.type === "batch" && "quotes" in data && Array.isArray(data.quotes)) {
    for (const quote of data.quotes) {
      if (isQuote(quote)) {
        quotes.push(quote)
      }
    }
    showProgress(`已讀取 ${quotes.length} 筆報價`)
    return
  }
  if (data.type === "done") {
    nextSeries = quotes.length === 0 ? demoSeries() : { quotes }
    seriesReady = true
    publish()
    return
  }
  if (data.type === "empty") {
    nextSeries = demoSeries()
    seriesReady = true
    publish()
  }
})

worker.addEventListener("error", () => {
  nextSeries = demoSeries()
  seriesReady = true
  publish()
})

function applyUsed(text: string): void {
  if (!text.startsWith("{")) {
    return
  }
  nextPosts = usedPostsFrom(JSON.parse(text))
  usedReady = true
  publish()
}

function loadUsedPosts(): void {
  void readThroughCache(`${import.meta.env.BASE_URL}data/used.json`, applyUsed).then((delivered) => {
    if (!delivered) {
      usedReady = true
      publish()
    }
  })
}

loadUsedPosts()
