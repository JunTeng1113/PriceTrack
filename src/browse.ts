import { brandCacheKey, clearPreparedCharts, preparedBrandChart, renderBrandSvg, renderPage, renderShell, storeBrandChart, usedMarkup, visibleChart } from "./page.ts"
import { present, type Action, type PriceSeries, type View } from "./present.ts"
import type { UsedPost } from "./used-post.ts"

function dayNumber(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (match === null) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return Math.floor(date.getTime() / 86400000)
}

function isSvg(node: Element | null): node is SVGSVGElement {
  return node !== null && node.tagName.toLowerCase() === "svg"
}

function svgOf(node: Element): SVGSVGElement | null {
  const owner = node instanceof SVGElement ? node.ownerSVGElement : null
  if (isSvg(owner)) {
    return owner
  }
  const closest = node.closest("svg")
  return isSvg(closest) ? closest : null
}

function readoutOf(node: Element): HTMLElement | null {
  const section = node.closest("section")
  if (section === null) {
    return null
  }
  const readout = section.querySelector('[aria-label="讀數"]')
  return readout instanceof HTMLElement ? readout : null
}

function pointerX(svg: Element, event: MouseEvent): number | null {
  const bounds = svg.getBoundingClientRect()
  if (bounds.width <= 0) {
    return null
  }
  let width = 100
  let origin = 0
  if ("viewBox" in svg && typeof svg.viewBox === "object" && svg.viewBox !== null && "baseVal" in svg.viewBox) {
    const base = svg.viewBox.baseVal
    if (
      typeof base === "object" &&
      base !== null &&
      "width" in base &&
      "x" in base &&
      typeof base.width === "number" &&
      typeof base.x === "number"
    ) {
      width = base.width === 0 ? 100 : base.width
      origin = base.x
    }
  }
  return ((event.clientX - bounds.left) / bounds.width) * width + origin
}

function circlesFor(svg: Element, code: string): Element[] {
  return [...svg.querySelectorAll("circle[data-date]")].filter((node) => node.getAttribute("data-code") === code)
}

function nearestByX(circles: readonly Element[], x: number): Element | null {
  let best: Element | null = null
  let bestDistance = Infinity
  for (const circle of circles) {
    const cx = Number(circle.getAttribute("cx"))
    if (!Number.isFinite(cx)) {
      continue
    }
    const distance = Math.abs(cx - x)
    if (distance < bestDistance) {
      best = circle
      bestDistance = distance
    }
  }
  return best
}

function laterCircle(circles: readonly Element[]): Element | null {
  let best: Element | null = null
  for (const circle of circles) {
    const date = circle.getAttribute("data-date") ?? ""
    const bestDate = best?.getAttribute("data-date") ?? ""
    if (best === null || date > bestDate) {
      best = circle
    }
  }
  return best
}

function nearestByDate(circles: readonly Element[], date: string): Element | null {
  const target = dayNumber(date)
  if (target === null) {
    return null
  }
  let best: Element | null = null
  let bestDistance: number | null = null
  for (const circle of circles) {
    const day = dayNumber(circle.getAttribute("data-date") ?? "")
    if (day === null) {
      continue
    }
    const distance = Math.abs(day - target)
    if (bestDistance === null || distance < bestDistance) {
      best = circle
      bestDistance = distance
    }
  }
  return best
}

function paintFocus(svg: Element, code: string | null): void {
  const active = code !== null && code !== ""
  const marks = svg.querySelectorAll("[data-code]")
  for (const mark of marks) {
    const same = mark.getAttribute("data-code") === code
    mark.setAttribute("opacity", active && !same ? "0.25" : "1")
    if (mark.getAttribute("data-series-label") === "true") {
      mark.setAttribute("data-focused", active && same ? "true" : "false")
    }
  }
}

function followLine(node: Element): void {
  const code = node.getAttribute("data-code") ?? ""
  const svg = svgOf(node)
  if (code === "" || svg === null) {
    return
  }
  paintFocus(svg, code)
}

function isOnLine(node: Element): boolean {
  const code = node.getAttribute("data-code") ?? ""
  if (code === "") {
    return false
  }
  if (node.getAttribute("data-series-label") === "true") {
    return true
  }
  const tag = node.tagName.toLowerCase()
  return tag === "line" || tag === "circle"
}

function leaveLine(node: Element, event: Event): void {
  if (!(event instanceof MouseEvent)) {
    return
  }
  const svg = svgOf(node)
  if (svg === null) {
    return
  }
  const next = event.relatedTarget
  if (next instanceof Element && isOnLine(next)) {
    return
  }
  paintFocus(svg, null)
  hideTooltip()
}

function ensureTooltip(): HTMLElement {
  const found = document.querySelector("[role=\"tooltip\"]")
  if (found instanceof HTMLElement) {
    return found
  }
  const tip = document.createElement("div")
  tip.setAttribute("role", "tooltip")
  tip.className = "pointer-events-none fixed z-50 hidden rounded-md border bg-background px-3 py-2 text-sm leading-5 shadow-md"
  document.body.append(tip)
  return tip
}

function placeTooltip(tip: HTMLElement, event: MouseEvent): void {
  const offset = 12
  const margin = 8
  tip.style.left = `${event.clientX + offset}px`
  tip.style.top = `${event.clientY + offset}px`
  const box = tip.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) {
    return
  }
  const maxLeft = Math.max(margin, window.innerWidth - box.width - margin)
  const maxTop = Math.max(margin, window.innerHeight - box.height - margin)
  tip.style.left = `${Math.min(Math.max(margin, event.clientX + offset), maxLeft)}px`
  tip.style.top = `${Math.min(Math.max(margin, event.clientY + offset), maxTop)}px`
}

function formatTooltipPrice(price: string): string {
  const value = Number(price)
  if (!Number.isFinite(value)) {
    return price
  }
  const rounded = Math.round(value)
  const negative = rounded < 0
  const digits = String(Math.abs(rounded))
  let grouped = ""
  for (let index = 0; index < digits.length; index += 1) {
    const remaining = digits.length - index
    if (index > 0 && remaining % 3 === 0) {
      grouped += ","
    }
    grouped += digits.charAt(index)
  }
  return negative ? `-$${grouped}` : `$${grouped}`
}

function showTooltip(date: string, code: string, price: string, event: MouseEvent, delisted = false): void {
  if (date === "" || code === "" || price === "") {
    return
  }
  const tip = ensureTooltip()
  tip.replaceChildren()
  const rows = [date, code, formatTooltipPrice(price)]
  if (delisted) {
    rows.push("下架")
  }
  for (const text of rows) {
    const row = document.createElement("p")
    row.textContent = text
    tip.append(row)
  }
  tip.classList.remove("hidden")
  placeTooltip(tip, event)
}

function hideTooltip(): void {
  const found = document.querySelector("[role=\"tooltip\"]")
  if (found instanceof HTMLElement) {
    found.classList.add("hidden")
  }
}

function endpointQuote(line: SVGLineElement): { date: string; price: string; delisted: boolean } | null {
  const toDate = line.getAttribute("data-to-date") ?? ""
  const toPrice = line.getAttribute("data-to-price") ?? ""
  if (toDate !== "" && toPrice !== "") {
    return { date: toDate, price: toPrice, delisted: false }
  }
  const fromDate = line.getAttribute("data-from-date") ?? ""
  const fromPrice = line.getAttribute("data-from-price") ?? ""
  if (fromDate === "" || fromPrice === "") {
    return null
  }
  return { date: fromDate, price: fromPrice, delisted: false }
}

function quoteAt(
  svg: Element,
  code: string,
  event: MouseEvent,
  line: SVGLineElement | null,
): { date: string; price: string; delisted: boolean } | null {
  const x = pointerX(svg, event)
  const circle = x === null
    ? line === null ? laterCircle(circlesFor(svg, code)) : null
    : nearestByX(circlesFor(svg, code), x)
  if (circle !== null) {
    const date = circle.getAttribute("data-date") ?? ""
    const price = circle.getAttribute("data-price") ?? ""
    if (date === "" || price === "") {
      return null
    }
    return { date, price, delisted: circle.getAttribute("data-delisted") === "true" }
  }
  return line === null ? null : endpointQuote(line)
}

type FilterDraft = {
  keyword: string
  chipGroups: string[]
  vendor: string
  start: string
  end: string
}

function pressedChipVendor(): string {
  const pressed = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="晶片廠"] button')]
    .find((button) => button.getAttribute("aria-pressed") === "true")
  return pressed?.textContent ?? ""
}

function showChipVendor(vendor: string): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[aria-label="晶片廠"] button')
  for (const button of buttons) {
    button.setAttribute("aria-pressed", button.textContent === vendor ? "true" : "false")
  }
  const items = document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')
  for (const item of items) {
    const shown = vendor !== "" && item.getAttribute("data-vendor") === vendor
    item.classList.toggle("hidden", !shown)
  }
}

function ensureChipVendor(): void {
  const current = pressedChipVendor()
  if (current !== "") {
    showChipVendor(current)
    return
  }
  const first = document.querySelector<HTMLButtonElement>('[aria-label="晶片廠"] button')
  const name = first?.textContent ?? ""
  if (name !== "") {
    showChipVendor(name)
  }
}
function selectedChipGroups(): string[] {
  return [...document.querySelectorAll('[data-slot="select-item"][aria-selected="true"]')]
    .map((item) => item.getAttribute("data-value") ?? "")
    .filter((name) => name !== "")
}

function readFilterDraft(): FilterDraft | null {
  const start = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')
  const end = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')
  const chip = document.querySelector('[aria-label="晶片分組"]')
  if (start === null || end === null || chip === null) {
    return null
  }
  return {
    keyword: "",
    chipGroups: selectedChipGroups(),
    vendor: pressedChipVendor(),
    start: start.value,
    end: end.value,
  }
}

function writeFilterDraft(draft: FilterDraft): void {
  const start = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')
  const end = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')
  const chip = document.querySelector('[aria-label="晶片分組"]')
  if (start !== null) {
    start.value = draft.start
  }
  if (end !== null) {
    end.value = draft.end
  }
  const items = document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')
  for (const item of items) {
    const name = item.getAttribute("data-value") ?? ""
    item.setAttribute("aria-selected", draft.chipGroups.includes(name) ? "true" : "false")
  }
  if (chip !== null) {
    chip.textContent = draft.chipGroups.join("、")
  }
  showChipVendor(draft.vendor)
}

const chartQuoteLimit = 2000
const markBatch = 1200

export function start(series: PriceSeries): {
  setSeries(next: PriceSeries): void
  setUsedPosts(next: readonly UsedPost[]): void
} {
  let latestView: View | null = null
  let usedPosts: readonly UsedPost[] = []
  let renderToken = 0
  let actions: Action[] = []
  let lockedCode: string | null = null
  let lockedSvg: SVGSVGElement | null = null

  const bindSelect = (label: string, apply: (item: HTMLElement) => void): void => {
    const trigger = document.querySelector(`[aria-label="${label}"]`)
    const root = trigger?.closest("[data-slot=\"select\"]") ?? null
    if (root === null) {
      return
    }
    const content = root.querySelector("[data-slot=\"select-content\"]")
    trigger?.addEventListener("click", () => {
      content?.classList.toggle("hidden")
    })
    const items = root.querySelectorAll<HTMLElement>("[data-slot=\"select-item\"]")
    for (const item of items) {
      item.addEventListener("click", () => {
        apply(item)
      })
    }
  }

  const writeReadout = (readout: HTMLElement | null, date: string, code: string, price: string): void => {
    if (readout === null || date === "" || code === "" || price === "") {
      return
    }
    readout.textContent = `${date} ${code} ${price}`
    actions = [
      ...actions.filter((action) => action.type !== "point"),
      { type: "point", date, code },
    ]
  }

  const draw = (keepDraft = true): void => {
    const draft = keepDraft ? readFilterDraft() : null
    lockedCode = null
    lockedSvg = null
    const scrollY = window.scrollY
    const paint = (html: string): void => {
      const parsed = new DOMParser().parseFromString(html, "text/html")
      document.documentElement.lang = parsed.documentElement.lang
      document.body.replaceChildren(...parsed.body.childNodes)
      if (draft !== null) {
        const renderedStart = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')?.value ?? ""
        const renderedEnd = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')?.value ?? ""
        writeFilterDraft({
          ...draft,
          start: draft.start === "" ? renderedStart : draft.start,
          end: draft.end === "" ? renderedEnd : draft.end,
        })
      }
    }

    const bindChart = (svg: SVGSVGElement): void => {
      const held = (code: string): boolean =>
        lockedCode !== null && (lockedSvg !== svg || lockedCode !== code)

      const chartMarks = svg.querySelectorAll<SVGElement>("[data-date], [data-day]")
      for (const mark of chartMarks) {
        const show = (event: Event): void => {
          const code = mark.getAttribute("data-code") ?? ""
          if (code === "") {
            return
          }
          const explicitDate = mark.getAttribute("data-date")
          if (explicitDate !== null && explicitDate !== "") {
            followLine(mark)
            const price = mark.getAttribute("data-price") ?? ""
            if (!held(code)) {
              writeReadout(readoutOf(svg), explicitDate, code, price)
            }
            if (event instanceof MouseEvent) {
              showTooltip(explicitDate, code, price, event, mark.getAttribute("data-delisted") === "true")
            }
            return
          }
          const circle = nearestByDate(circlesFor(svg, code), mark.getAttribute("data-day") ?? "")
          if (circle === null) {
            return
          }
          writeReadout(
            readoutOf(svg),
            circle.getAttribute("data-date") ?? "",
            code,
            circle.getAttribute("data-price") ?? "",
          )
        }
        mark.addEventListener("click", show)
        mark.addEventListener("mouseover", show)
        mark.addEventListener("mouseout", (event) => {
          leaveLine(mark, event)
        })
      }

      const seriesLines = svg.querySelectorAll<SVGLineElement>("line[data-code]")
      for (const line of seriesLines) {
        line.addEventListener("click", (event) => {
          if (!(event instanceof MouseEvent)) {
            return
          }
          const code = line.getAttribute("data-code") ?? ""
          if (code === "") {
            return
          }
          if (lockedCode === code && lockedSvg === svg) {
            lockedCode = null
            lockedSvg = null
            return
          }
          lockedCode = code
          lockedSvg = svg
          const quote = quoteAt(svg, code, event, line)
          if (quote === null) {
            return
          }
          writeReadout(readoutOf(svg), quote.date, code, quote.price)
        })
        line.addEventListener("mouseover", (event) => {
          if (!(event instanceof MouseEvent)) {
            return
          }
          followLine(line)
          const code = line.getAttribute("data-code") ?? ""
          if (code === "") {
            return
          }
          const quote = quoteAt(svg, code, event, line)
          if (quote === null) {
            return
          }
          if (!held(code)) {
            writeReadout(readoutOf(svg), quote.date, code, quote.price)
          }
          showTooltip(quote.date, code, quote.price, event, quote.delisted)
        })
        line.addEventListener("mousemove", (event) => {
          if (!(event instanceof MouseEvent)) {
            return
          }
          const code = line.getAttribute("data-code") ?? ""
          if (code === "") {
            return
          }
          const quote = quoteAt(svg, code, event, line)
          if (quote === null) {
            return
          }
          showTooltip(quote.date, code, quote.price, event, quote.delisted)
        })
        line.addEventListener("mouseout", (event) => {
          leaveLine(line, event)
        })
      }

      const seriesLabels = svg.querySelectorAll<SVGTextElement>("text[data-series-label]")
      for (const label of seriesLabels) {
        label.addEventListener("mouseover", () => {
          followLine(label)
        })
        label.addEventListener("mouseout", (event) => {
          leaveLine(label, event)
        })
      }

      svg.addEventListener("mousemove", (event) => {
        if (!(event instanceof MouseEvent) || lockedSvg !== svg || lockedCode === null) {
          return
        }
        const quote = quoteAt(svg, lockedCode, event, null)
        if (quote === null) {
          return
        }
        writeReadout(readoutOf(svg), quote.date, lockedCode, quote.price)
      })
    }

    const showPreparedBrand = (section: Element, brands: readonly string[]): boolean => {
      const group = section.getAttribute("aria-label") ?? ""
      const key = brandCacheKey(brands)
      const markup = preparedBrandChart(group, key) ?? (latestView === null ? null : renderBrandSvg(latestView, group, brands))
      if (markup === null) {
        return false
      }
      const parsed = new DOMParser().parseFromString(markup, "text/html")
      const nextSvg = parsed.querySelector("svg")
      const current = section.querySelector("svg[data-price-chart]")
      if (!isSvg(nextSvg) || !isSvg(current)) {
        return false
      }
      if (lockedSvg === current) {
        lockedCode = null
        lockedSvg = null
      }
      current.replaceWith(nextSvg)
      bindChart(nextSvg)
      if (latestView !== null) {
        paintUsed(section, usedMarkup(latestView, group, brands))
      }
      return true
    }

    const paintUsed = (section: Element, markup: string): void => {
      const existing = section.querySelector("[data-used]")
      if (markup === "") {
        existing?.remove()
        return
      }
      const parsed = new DOMParser().parseFromString(markup, "text/html")
      const next = parsed.querySelector("[data-used]")
      if (next === null) {
        return
      }
      if (existing === null) {
        section.append(next)
      } else {
        existing.replaceWith(next)
      }
    }

    const bindBrands = (scope: ParentNode): void => {
      const brandButtons = scope.querySelectorAll<HTMLButtonElement>('[aria-label="品牌"] button')
      for (const button of brandButtons) {
        button.addEventListener("click", () => {
          const section = button.closest("section")
          const name = button.textContent ?? ""
          if (section === null || name === "") {
            return
          }
          const group = section.getAttribute("aria-label") ?? ""
          const wasPressed = button.getAttribute("aria-pressed") === "true"
          const selected = [...section.querySelectorAll<HTMLButtonElement>('[aria-label="品牌"] button')]
            .filter((peer) => peer !== button && peer.getAttribute("aria-pressed") === "true")
            .map((peer) => peer.textContent ?? "")
            .filter((text) => text !== "")
          if (!wasPressed) {
            selected.push(name)
          }
          if (!showPreparedBrand(section, selected)) {
            return
          }
          button.setAttribute("aria-pressed", wasPressed ? "false" : "true")
          actions = [
            ...actions.filter((action) =>
              (action.type !== "setBrand" && action.type !== "setFocus") || action.group !== group,
            ),
            ...selected.map((brand) => ({ type: "setBrand" as const, group, name: brand })),
          ]
        })
      }
    }

    const bindShell = (): void => {
      bindSelect("晶片分組", (item) => {
        const trigger = document.querySelector('[aria-label="晶片分組"]')
        if (trigger === null) {
          return
        }
        const next = item.getAttribute("aria-selected") === "true" ? "false" : "true"
        item.setAttribute("aria-selected", next)
        trigger.textContent = selectedChipGroups().join("、")
      })
      bindBrands(document)

    const search = document.querySelector<HTMLButtonElement>('button[aria-label="搜尋"]')
    search?.addEventListener("click", () => {
      const nextDraft = readFilterDraft()
      if (nextDraft === null) {
        return
      }
      const kept = actions.filter((action) =>
        action.type !== "setKeyword" && action.type !== "setChipGroup" && action.type !== "setRange",
      )
      const next: Action[] = [
        ...kept,
        { type: "setKeyword", text: nextDraft.keyword },
      ]
      for (const name of nextDraft.chipGroups) {
        next.push({ type: "setChipGroup", name })
      }
      if (nextDraft.start !== "" && nextDraft.end !== "") {
        next.push({ type: "setRange", start: nextDraft.start, end: nextDraft.end })
      }
      actions = next
      draw(false)
      showChipVendor(nextDraft.vendor)
    })

    const generationButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="世代"] button')
    for (const button of generationButtons) {
      button.addEventListener("click", () => {
        const label = button.textContent ?? ""
        const name = label === "30系列" ? "30" : label === "40系列" ? "40" : label === "50系列" ? "50" : ""
        if (name === "") {
          return
        }
        const draft = readFilterDraft()
        actions = [
          ...actions.filter((action) => action.type !== "setChipGroup" && action.type !== "setGeneration"),
          { type: "setGeneration", name },
        ]
        draw(false)
        if (draft !== null) {
          showChipVendor(draft.vendor)
        }
      })
    }

    const vendorButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="晶片廠"] button')
    for (const button of vendorButtons) {
      button.addEventListener("click", () => {
        const name = button.textContent ?? ""
        if (name === "") {
          return
        }
        showChipVendor(name)
      })
    }
    ensureChipVendor()

    const buttons = document.querySelectorAll<HTMLButtonElement>('[aria-label="候選"] button')
    for (const button of buttons) {
      button.addEventListener("click", () => {
        const code = button.textContent ?? ""
        if (code === "") {
          return
        }
        const type: "select" | "deselect" = button.getAttribute("aria-pressed") === "true" ? "deselect" : "select"
        actions = [...actions, { type, code }]
        draw()
      })
    }

    const removeButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="已選"] button')
    for (const button of removeButtons) {
      button.addEventListener("click", () => {
        const code = button.dataset.code ?? ""
        if (code === "") {
          return
        }
        actions = [...actions, { type: "deselect", code }]
        draw()
      })
    }
    }

    const bindDrawnCharts = (): void => {
      const charts = document.querySelectorAll("svg[data-price-chart]")
      for (const chart of charts) {
        const svg = svgOf(chart)
        if (svg === null) {
          continue
        }
        bindChart(svg)
      }
    }

    const rememberChart = (group: string, brand: string, svg: SVGSVGElement): void => {
      storeBrandChart(group, brand, svg.outerHTML)
    }

    const paintCharts = (view: View, generation: number): void => {
      const host = document.querySelector(".p-4")
      const note = document.querySelector("[data-loading]")
      const charts = view.modelCharts
      const appendChart = (index: number): void => {
        if (generation !== renderToken) {
          return
        }
        const chart = charts[index]
        if (chart === undefined || host === null) {
          note?.remove()
          return
        }
        if (note !== null) {
          note.textContent = `正在繪製圖表 ${index + 1}/${charts.length}`
        }
        const piece = visibleChart(view, chart)
        const parsed = new DOMParser().parseFromString(piece.section, "text/html")
        const section = parsed.querySelector("section")
        const svg = section?.querySelector("svg[data-price-chart]") ?? null
        if (section === null || !isSvg(svg)) {
          setTimeout(() => appendChart(index + 1), 0)
          return
        }
        host.append(section)
        bindBrands(section)
        const pump = (offset: number): void => {
          if (generation !== renderToken || !svg.isConnected) {
            return
          }
          const slice = piece.marks.slice(offset, offset + markBatch).join("")
          if (slice !== "") {
            const parsedMarks = new DOMParser().parseFromString(
              `<svg xmlns="http://www.w3.org/2000/svg">${slice}</svg>`,
              "image/svg+xml",
            )
            const root = parsedMarks.documentElement
            if (root.namespaceURI === "http://www.w3.org/2000/svg" && root.localName !== "parsererror") {
              while (root.firstChild !== null) {
                svg.append(root.firstChild)
              }
            }
          }
          if (offset + markBatch < piece.marks.length) {
            setTimeout(() => pump(offset + markBatch), 0)
            return
          }
          rememberChart(chart.group, brandCacheKey(chart.selectedBrands), svg)
          bindChart(svg)
          setTimeout(() => appendChart(index + 1), 0)
        }
        setTimeout(() => pump(0), 0)
      }
      setTimeout(() => appendChart(0), 0)
    }

    if (series.quotes.length > chartQuoteLimit) {
      const generation = renderToken + 1
      renderToken = generation
      const loading = document.querySelector("[data-loading]")
      if (loading !== null) {
        loading.textContent = "正在整理報價"
      }
      setTimeout(() => {
        if (generation !== renderToken) {
          return
        }
        const view = present(series, actions, usedPosts)
        latestView = view
        clearPreparedCharts()
        paint(renderShell(view, actions))
        bindShell()
        const status = document.createElement("p")
        status.setAttribute("data-loading", "")
        status.setAttribute("aria-live", "polite")
        status.textContent = "正在繪製圖表"
        document.querySelector("section")?.append(status)
        if (typeof window.scrollTo === "function") {
          window.scrollTo(0, scrollY)
        }
        paintCharts(view, generation)
      }, 0)
      return
    }

    renderToken += 1
    latestView = present(series, actions, usedPosts)
    paint(renderPage(series, actions, usedPosts))
    bindShell()
    bindDrawnCharts()

    if (typeof window.scrollTo === "function") {
      window.scrollTo(0, scrollY)
    }
  }

  draw()
  return {
    setSeries(next: PriceSeries): void {
      series = next
      draw(true)
    },
    setUsedPosts(next: readonly UsedPost[]): void {
      usedPosts = next
      if (series.quotes.length > 0) {
        draw(true)
      }
    },
  }
}
