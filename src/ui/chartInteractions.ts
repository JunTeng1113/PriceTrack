import { indicatorLabel, type IndicatorWindow } from "../page.ts"

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
      typeof base === "object"
      && base !== null
      && "width" in base
      && "x" in base
      && typeof base.width === "number"
      && typeof base.x === "number"
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

function focusScope(node: Element): Element {
  return node.closest("[data-chart-width]") ?? svgOf(node) ?? node
}

function paintFocus(scope: Element, code: string | null): void {
  const active = code !== null && code !== ""
  const marks = scope.querySelectorAll("[data-code]")
  for (const mark of marks) {
    const same = mark.getAttribute("data-code") === code
    mark.setAttribute("opacity", active && !same ? "0.25" : "1")
    if (mark.getAttribute("data-series-label") === "true") {
      mark.setAttribute("data-focused", active && same ? "true" : "false")
    }
  }
  const plotted = scope.querySelector("svg[data-price-chart], svg[data-trend-chart]")
  if (isSvg(plotted)) {
    raiseFocusedMarks(plotted, active ? code : null)
    return
  }
  if (isSvg(scope)) {
    raiseFocusedMarks(scope, active ? code : null)
  }
}

const raisedOrder = new WeakMap<Element, number>()
const raisedReady = new WeakSet<Element>()

function isRaisedMark(node: Element): boolean {
  if (node.getAttribute("data-hit") === "true" || !node.hasAttribute("data-code")) {
    return false
  }
  const tag = node.tagName.toLowerCase()
  return tag === "line" || tag === "circle"
}

function rememberRaised(svg: Element): void {
  if (raisedReady.has(svg)) {
    return
  }
  let index = 0
  for (const child of svg.children) {
    if (!isRaisedMark(child)) {
      continue
    }
    raisedOrder.set(child, index)
    index += 1
  }
  raisedReady.add(svg)
}

function raiseFocusedMarks(svg: Element, code: string | null): void {
  rememberRaised(svg)
  const marks = [...svg.children].filter((node) => isRaisedMark(node))
  const anchor = [...svg.children].find((node) => node.getAttribute("data-series-label") === "true") ?? null
  const ordered = [...marks].sort((left, right) => {
    const leftFocused = code !== null && left.getAttribute("data-code") === code
    const rightFocused = code !== null && right.getAttribute("data-code") === code
    if (leftFocused !== rightFocused) {
      return leftFocused ? 1 : -1
    }
    return (raisedOrder.get(left) ?? 0) - (raisedOrder.get(right) ?? 0)
  })
  for (const node of ordered) {
    if (anchor === null) {
      svg.append(node)
    } else {
      svg.insertBefore(node, anchor)
    }
  }
}

function followLine(node: Element): void {
  const code = node.getAttribute("data-code") ?? ""
  if (code === "") {
    return
  }
  paintFocus(focusScope(node), code)
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
  const scope = focusScope(node)
  const next = event.relatedTarget
  if (next instanceof Element && scope.contains(next) && isOnLine(next)) {
    return
  }
  paintFocus(scope, null)
  hideTooltip()
}

function ensureTooltip(): HTMLElement {
  const found = document.querySelector('[role="tooltip"]')
  if (found instanceof HTMLElement) {
    return found
  }
  const tip = document.createElement("div")
  tip.setAttribute("role", "tooltip")
  tip.className =
    "pointer-events-none fixed z-50 hidden rounded-md border border-line bg-white px-3 py-2 text-sm leading-5 shadow-md"
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

function showTooltip(
  date: string,
  code: string,
  price: string,
  event: MouseEvent,
  delisted = false,
  note = "",
  extra = "",
): void {
  if (date === "" || code === "" || price === "") {
    return
  }
  const tip = ensureTooltip()
  tip.replaceChildren()
  const rows = [date, code, formatTooltipPrice(price)]
  if (note !== "") {
    rows.push(note)
  }
  if (extra !== "") {
    rows.push(extra)
  }
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

function percentileRow(dot: Element, date: string): string {
  const svg = dot.closest("svg")
  if (svg === null || date === "") {
    return ""
  }
  const window = svg.getAttribute("data-indicator") ?? "month"
  const price =
    svg.querySelector(`circle[data-percentile="50"][data-window="${window}"][data-date="${date}"]`)?.getAttribute(
      "data-price",
    ) ?? ""
  if (price === "") {
    return ""
  }
  return `50% 區間 ${formatTooltipPrice(price)}`
}

function hideTooltip(): void {
  const found = document.querySelector('[role="tooltip"]')
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
  const circle =
    x === null
      ? line === null
        ? laterCircle(circlesFor(svg, code))
        : null
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

type ChartLock = {
  code: string | null
  svg: SVGSVGElement | null
}

function bindChart(svg: SVGSVGElement, lock: ChartLock): void {
  if (svg.dataset.bound === "true") {
    return
  }
  svg.dataset.bound = "true"
  const held = (code: string): boolean => lock.code !== null && (lock.svg !== svg || lock.code !== code)
  const scope: Element = svg.closest("[data-chart-width]") ?? svg

  const chartMarks = scope.querySelectorAll<SVGElement>("[data-date], [data-day]")
  for (const mark of chartMarks) {
    if (mark.getAttribute("data-used-price") === "true") {
      continue
    }
    const show = (event: Event): void => {
      const code = mark.getAttribute("data-code") ?? ""
      if (code === "") {
        return
      }
      const explicitDate = mark.getAttribute("data-date")
      if (explicitDate !== null && explicitDate !== "") {
        followLine(mark)
        const price = mark.getAttribute("data-price") ?? ""
        if (event instanceof MouseEvent) {
          showTooltip(explicitDate, code, price, event, mark.getAttribute("data-delisted") === "true")
        }
        return
      }
      const circle = nearestByDate(circlesFor(svg, code), mark.getAttribute("data-day") ?? "")
      if (circle === null) {
        return
      }
      void circle
    }
    mark.addEventListener("click", show)
    mark.addEventListener("mouseover", show)
    mark.addEventListener("mouseout", (event) => {
      leaveLine(mark, event)
    })
  }

  const seriesLines = scope.querySelectorAll<SVGLineElement>("line[data-code]")
  for (const line of seriesLines) {
    line.addEventListener("click", (event) => {
      if (!(event instanceof MouseEvent)) {
        return
      }
      const code = line.getAttribute("data-code") ?? ""
      if (code === "") {
        return
      }
      if (lock.code === code && lock.svg === svg) {
        lock.code = null
        lock.svg = null
        return
      }
      lock.code = code
      lock.svg = svg
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
      void held(code)
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

  const usedRoot = svg.getAttribute("data-trend-chart") !== null
    ? svg.closest("section")
    : svg.closest("section")?.querySelector('[aria-label="價格趨勢"]')
  const usedDots = usedRoot?.querySelectorAll("[data-used-price]") ?? []
  for (const dot of usedDots) {
    if (dot.getAttribute("data-bound") === "true") {
      continue
    }
    dot.setAttribute("data-bound", "true")
    const showUsed = (event: Event): void => {
      if (!(event instanceof MouseEvent)) {
        return
      }
      const date = dot.getAttribute("data-date") ?? ""
      showTooltip(
        date,
        dot.getAttribute("data-code") ?? "",
        dot.getAttribute("data-price") ?? "",
        event,
        false,
        "二手開價",
        percentileRow(dot, date),
      )
    }
    dot.addEventListener("mouseover", showUsed)
    dot.addEventListener("mousemove", showUsed)
    dot.addEventListener("mouseout", () => {
      hideTooltip()
    })
  }

  const seriesLabels = scope.querySelectorAll<SVGTextElement>("text[data-series-label]")
  for (const label of seriesLabels) {
    label.addEventListener("mouseover", () => {
      followLine(label)
    })
    label.addEventListener("mouseout", (event) => {
      leaveLine(label, event)
    })
  }
}

function bindChartsIn(root: ParentNode, lock: ChartLock): void {
  for (const node of root.querySelectorAll("svg[data-price-chart], svg[data-trend-chart]")) {
    if (isSvg(node)) {
      bindChart(node, lock)
    }
  }
}

function rebindChart(svg: SVGSVGElement, lock: ChartLock): void {
  delete svg.dataset.bound
  bindChart(svg, lock)
}

export {
  bindChartsIn,
  rebindChart,
  hideTooltip,
  indicatorLabel,
  isSvg,
  type ChartLock,
  type IndicatorWindow,
}
