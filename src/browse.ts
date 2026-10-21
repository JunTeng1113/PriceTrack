import { renderPage } from "./page.ts"
import type { Action, PriceSeries } from "./present.ts"

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
  const marks = svg.querySelectorAll("[data-code]")
  for (const mark of marks) {
    const faded = code !== null && code !== "" && mark.getAttribute("data-code") !== code
    mark.setAttribute("opacity", faded ? "0.25" : "1")
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

function leaveLine(node: Element, event: Event): void {
  if (!(event instanceof MouseEvent)) {
    return
  }
  const svg = svgOf(node)
  if (svg === null) {
    return
  }
  const next = event.relatedTarget
  if (next instanceof Element && svg.contains(next)) {
    const onLine = next.getAttribute("data-code") ?? next.closest("[data-code]")?.getAttribute("data-code") ?? ""
    if (onLine !== "") {
      return
    }
  }
  paintFocus(svg, null)
}

function endpointQuote(line: SVGLineElement): { date: string; price: string } | null {
  const toDate = line.getAttribute("data-to-date") ?? ""
  const toPrice = line.getAttribute("data-to-price") ?? ""
  if (toDate !== "" && toPrice !== "") {
    return { date: toDate, price: toPrice }
  }
  const fromDate = line.getAttribute("data-from-date") ?? ""
  const fromPrice = line.getAttribute("data-from-price") ?? ""
  if (fromDate === "" || fromPrice === "") {
    return null
  }
  return { date: fromDate, price: fromPrice }
}

function quoteAt(
  svg: Element,
  code: string,
  event: MouseEvent,
  line: SVGLineElement | null,
): { date: string; price: string } | null {
  const x = pointerX(svg, event)
  const circle = x === null
    ? line === null ? laterCircle(circlesFor(svg, code)) : null
    : nearestByX(circlesFor(svg, code), x)
  if (circle !== null) {
    const date = circle.getAttribute("data-date") ?? ""
    const price = circle.getAttribute("data-price") ?? ""
    return date === "" || price === "" ? null : { date, price }
  }
  return line === null ? null : endpointQuote(line)
}

type FilterDraft = {
  keyword: string
  chipGroup: string
  start: string
  end: string
}

function readFilterDraft(): FilterDraft | null {
  const keyword = document.querySelector<HTMLInputElement>('input[aria-label="關鍵字"]')
  const start = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')
  const end = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')
  const chip = document.querySelector('[aria-label="晶片分組"]')
  if (keyword === null || start === null || end === null || chip === null) {
    return null
  }
  return {
    keyword: keyword.value,
    chipGroup: chip.textContent ?? "",
    start: start.value,
    end: end.value,
  }
}

function writeFilterDraft(draft: FilterDraft): void {
  const keyword = document.querySelector<HTMLInputElement>('input[aria-label="關鍵字"]')
  const start = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')
  const end = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')
  const chip = document.querySelector('[aria-label="晶片分組"]')
  if (keyword !== null) {
    keyword.value = draft.keyword
  }
  if (start !== null) {
    start.value = draft.start
  }
  if (end !== null) {
    end.value = draft.end
  }
  if (chip !== null) {
    chip.textContent = draft.chipGroup
  }
}

export function start(series: PriceSeries): void {
  let actions: Action[] = []
  let lockedCode: string | null = null
  let lockedSvg: SVGSVGElement | null = null

  const bindSelect = (label: string, apply: (name: string) => void): void => {
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
        apply(item.dataset.value ?? "")
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
    const html = renderPage(series, actions)
    const parsed = new DOMParser().parseFromString(html, "text/html")
    document.documentElement.lang = parsed.documentElement.lang
    document.body.replaceChildren(...parsed.body.childNodes)
    if (draft !== null) {
      writeFilterDraft(draft)
    }

    bindSelect("晶片分組", (name) => {
      const trigger = document.querySelector('[aria-label="晶片分組"]')
      const root = trigger?.closest("[data-slot=\"select\"]") ?? null
      if (trigger === null || root === null) {
        return
      }
      trigger.textContent = name
      root.querySelector("[data-slot=\"select-content\"]")?.classList.add("hidden")
    })
    const brandButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="品牌"] button')
    for (const button of brandButtons) {
      button.addEventListener("click", () => {
        const group = button.closest("section")?.getAttribute("aria-label") ?? ""
        const name = button.textContent ?? ""
        if (group === "" || name === "") {
          return
        }
        const next = button.getAttribute("aria-pressed") === "true" ? "" : name
        actions = [
          ...actions.filter((action) =>
            (action.type !== "setBrand" && action.type !== "setFocus") || action.group !== group,
          ),
          { type: "setBrand", group, name: next },
        ]
        draw()
      })
    }

    const seriesLabels = document.querySelectorAll("svg text[data-series-label]")
    for (const label of seriesLabels) {
      label.addEventListener("mouseover", () => {
        followLine(label)
      })
      label.addEventListener("mouseout", (event) => {
        leaveLine(label, event)
      })
      label.addEventListener("click", () => {
        const group = label.closest("section")?.getAttribute("aria-label") ?? ""
        const code = label.getAttribute("data-code") ?? ""
        if (group === "" || code === "") {
          return
        }
        const next = label.getAttribute("data-focused") === "true" ? "" : code
        actions = [
          ...actions.filter((action) => action.type !== "setFocus" || action.group !== group),
          { type: "setFocus", group, code: next },
        ]
        draw()
      })
    }

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
        { type: "setChipGroup", name: nextDraft.chipGroup },
      ]
      if (nextDraft.start !== "" && nextDraft.end !== "") {
        next.push({ type: "setRange", start: nextDraft.start, end: nextDraft.end })
      }
      actions = next
      draw(false)
    })

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

    const held = (svg: SVGSVGElement, code: string): boolean =>
      lockedCode !== null && (lockedSvg !== svg || lockedCode !== code)

    const chartMarks = document.querySelectorAll<SVGElement>("svg [data-date], svg [data-day]")
    for (const mark of chartMarks) {
      const show = (): void => {
        followLine(mark)
        const code = mark.getAttribute("data-code") ?? ""
        const svg = svgOf(mark)
        if (code === "" || svg === null || held(svg, code)) {
          return
        }
        const explicitDate = mark.getAttribute("data-date")
        if (explicitDate !== null && explicitDate !== "") {
          writeReadout(readoutOf(svg), explicitDate, code, mark.getAttribute("data-price") ?? "")
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

    const seriesLines = document.querySelectorAll<SVGLineElement>("svg line[data-code]")
    for (const line of seriesLines) {
      line.addEventListener("click", (event) => {
        if (!(event instanceof MouseEvent)) {
          return
        }
        const code = line.getAttribute("data-code") ?? ""
        const svg = svgOf(line)
        if (code === "" || svg === null) {
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
        const svg = svgOf(line)
        if (code === "" || svg === null || held(svg, code)) {
          return
        }
        const quote = quoteAt(svg, code, event, line)
        if (quote === null) {
          return
        }
        writeReadout(readoutOf(svg), quote.date, code, quote.price)
      })
      line.addEventListener("mouseout", (event) => {
        leaveLine(line, event)
      })
    }

    const charts = document.querySelectorAll("svg")
    for (const chart of charts) {
      const svg = svgOf(chart)
      if (svg === null) {
        continue
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

    if (typeof window.scrollTo === "function") {
      window.scrollTo(0, scrollY)
    }
  }

  draw()
}
