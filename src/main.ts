import { renderPage } from "./page.ts"
import { emptySeries, update, type Action, type Snapshot } from "./present.ts"

const snapshot: Snapshot = {
  capturedAt: "2024-06-15T02:00:00.000Z",
  html: `
    <tr>
      <td>顯示卡VGA</td>
      <td>
        <select name="n12">
          <option>共有商品 1 樣</option>
          <optgroup label="NVIDIA RTX4070">
            <option>｛華碩 DUAL-RTX4070-O12G｝2535MHz/24cm/雙風扇, $18990</option>
          </optgroup>
        </select>
      </td>
    </tr>
  `,
}

const series = update(emptySeries(), [snapshot])
let actions: Action[] = []

function draw(): void {
  const html = renderPage(series, actions)
  const parsed = new DOMParser().parseFromString(html, "text/html")
  document.documentElement.lang = parsed.documentElement.lang
  document.body.replaceChildren(...parsed.body.childNodes)

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
      actions = [...actions, { type: "select", code }]
      draw()
    })
  }

  for (const label of ["起日", "迄日"]) {
    const field = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)
    if (field === null) {
      continue
    }
    field.addEventListener("change", () => {
      const start = document.querySelector<HTMLInputElement>('input[aria-label="起日"]')
      const end = document.querySelector<HTMLInputElement>('input[aria-label="迄日"]')
      if (start === null || end === null || start.value === "" || end.value === "") {
        return
      }
      actions = [
        ...actions.filter((action) => action.type !== "setRange"),
        { type: "setRange", start: start.value, end: end.value },
      ]
      draw()
    })
  }
}

draw()
