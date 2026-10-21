// @vitest-environment happy-dom

import { expect, test } from "vitest"
import { start } from "../src/browse.ts"
import { emptySeries, update, type Snapshot } from "../src/present.ts"

const dual = "華碩 DUAL-RTX4070-O12G"
const other = "華碩 RTX4060"

function snapshot(capturedAt: string, rows: readonly string[]): Snapshot {
  const options = rows.map((row) => `<option>${row}</option>`).join("")
  return {
    capturedAt,
    html: `
      <tr>
        <td>顯示卡VGA</td>
        <td>
          <select name="n12">${options}</select>
        </td>
      </tr>
    `,
  }
}

function selectCode(code: string): void {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="關鍵字"]')
  if (input === null) {
    return
  }
  input.value = code
  document.querySelector<HTMLButtonElement>('button[aria-label="搜尋"]')?.click()
  const button = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="候選"] button')]
    .find((item) => item.textContent === code)
  button?.click()
}

test("在折線圖上指向一個日子，讀出該序列的日期、代號與售價", () => {
  const series = update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`｛${dual}｝, $18990`, `｛${other}｝, $9000`]),
    snapshot("2024-06-16T02:00:00.000Z", [`｛${dual}｝, $17990`]),
  ])
  start(series)
  selectCode(dual)
  selectCode(other)

  const mark = document.querySelector<SVGElement>(
    '[aria-label="折線圖"] [data-date="2024-06-16"][data-code="華碩 DUAL-RTX4070-O12G"]',
  )
  mark?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

  expect(document.querySelector('[aria-label="讀數"]')).toBeNull()
})

test("在折線圖上指向缺日，距離相同時讀出較早那天的售價", () => {
  const series = update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`｛${dual}｝, $18990`]),
    snapshot("2024-06-16T02:00:00.000Z", [`｛${other}｝, $9000`]),
    snapshot("2024-06-17T02:00:00.000Z", [`｛${dual}｝, $17000`]),
  ])
  start(series)
  selectCode(dual)
  selectCode(other)

  const mark = document.querySelector<SVGElement>(
    '[aria-label="折線圖"] [data-day="2024-06-16"][data-code="華碩 DUAL-RTX4070-O12G"]',
  )
  mark?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

  expect(document.querySelector('[aria-label="讀數"]')).toBeNull()
})

test("在折線圖上指向缺日，讀出該序列較近的售價，不含另一條已選", () => {
  const series = update(emptySeries(), [
    snapshot("2024-06-15T02:00:00.000Z", [`｛${dual}｝, $18990`]),
    snapshot("2024-06-16T02:00:00.000Z", [`｛${other}｝, $9000`]),
    snapshot("2024-06-20T02:00:00.000Z", [`｛${dual}｝, $17000`]),
  ])
  start(series)
  selectCode(dual)
  selectCode(other)

  const mark = document.querySelector<SVGElement>(
    '[aria-label="折線圖"] [data-day="2024-06-16"][data-code="華碩 DUAL-RTX4070-O12G"]',
  )
  mark?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))

  expect(document.querySelector('[aria-label="讀數"]')).toBeNull()
})
