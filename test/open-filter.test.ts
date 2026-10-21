// @vitest-environment happy-dom

import { expect, test } from "vitest"
import "../src/main.ts"

function candidateTexts(): string[] {
  return [...document.querySelectorAll('[aria-label="候選"] li')].map((item) => item.textContent ?? "")
}

test("選了晶片分組後候選出現代號，點下去圖上有售價", () => {
  expect(candidateTexts()).toEqual([])

  const content = document.querySelector('[data-slot="select-content"]')
  expect(content?.classList.contains("hidden")).toBe(true)
  document.querySelector<HTMLElement>('[data-slot="select-trigger"]')?.click()
  expect(content?.classList.contains("hidden")).toBe(false)

  const group = [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')]
    .find((item) => item.textContent === "NVIDIA RTX4070")
  expect(group).not.toBeUndefined()
  group?.click()

  expect(candidateTexts()).toEqual(["華碩 DUAL-RTX4070-O12G"])
  expect(document.body.textContent).not.toContain("2535MHz")

  const button = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  button?.click()

  const point = document.querySelector('[aria-label="價格點"] li')
  expect(point?.textContent).toContain("2024-06-15")
  expect(point?.textContent).toContain("華碩 DUAL-RTX4070-O12G")
  expect(point?.textContent).toContain("18990")

  const input = document.querySelector<HTMLInputElement>('input[aria-label="關鍵字"]')
  expect(input).not.toBeNull()
  if (input === null) {
    return
  }
  input.value = "不存在"
  input.dispatchEvent(new Event("input", { bubbles: true }))

  expect(candidateTexts()).toEqual([])
  const selected = [...document.querySelectorAll('[aria-label="已選"] li span')].map((item) => item.textContent)
  expect(selected).toEqual(["華碩 DUAL-RTX4070-O12G"])
})
