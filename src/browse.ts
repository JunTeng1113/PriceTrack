import { renderPage } from "./page.ts"
import type { Action, PriceSeries } from "./present.ts"

export function start(series: PriceSeries): void {
  let actions: Action[] = []

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

  const draw = (): void => {
    const html = renderPage(series, actions)
    const parsed = new DOMParser().parseFromString(html, "text/html")
    document.documentElement.lang = parsed.documentElement.lang
    document.body.replaceChildren(...parsed.body.childNodes)

    bindSelect("晶片分組", (name) => {
      actions = [
        ...actions.filter((action) => action.type !== "setChipGroup"),
        { type: "setChipGroup", name },
      ]
      draw()
    })
    bindSelect("品牌", (name) => {
      actions = [
        ...actions.filter((action) => action.type !== "setBrand"),
        { type: "setBrand", name },
      ]
      draw()
    })

    const input = document.querySelector<HTMLInputElement>('input[aria-label="關鍵字"]')
    if (input !== null) {
      input.addEventListener("input", () => {
        const text = input.value
        actions = [
          ...actions.filter((action) => action.type !== "setKeyword"),
          { type: "setKeyword", text },
        ]
        draw()
        const next = document.querySelector<HTMLInputElement>('input[aria-label="關鍵字"]')
        if (next !== null) {
          next.focus()
          const end = next.value.length
          next.setSelectionRange(end, end)
        }
      })
    }

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

    const showPoint = (date: string, code: string): void => {
      if (date === "" || code === "") {
        return
      }
      actions = [
        ...actions.filter((action) => action.type !== "point"),
        { type: "point", date, code },
      ]
      draw()
    }

    const pointButtons = document.querySelectorAll<HTMLButtonElement>('[aria-label="價格點"] button')
    for (const button of pointButtons) {
      const show = (): void => {
        showPoint(button.dataset.date ?? "", button.dataset.code ?? "")
      }
      button.addEventListener("click", show)
      button.addEventListener("mouseover", show)
    }

    const chartMarks = document.querySelectorAll<SVGElement>("svg [data-date], svg [data-day]")
    for (const mark of chartMarks) {
      const show = (): void => {
        const date = mark.getAttribute("data-date") ?? mark.getAttribute("data-day") ?? ""
        showPoint(date, mark.getAttribute("data-code") ?? "")
      }
      mark.addEventListener("click", show)
      mark.addEventListener("mouseover", show)
    }

    for (const label of ["起日", "迄日"]) {
      const field = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
      if (field === null) {
        continue
      }
      field.addEventListener("change", () => {
        const startField = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')
        const endField = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')
        if (startField === null || endField === null || startField.value === "" || endField.value === "") {
          return
        }
        actions = [
          ...actions.filter((action) => action.type !== "setRange"),
          { type: "setRange", start: startField.value, end: endField.value },
        ]
        draw()
      })
    }
  }

  draw()
}
