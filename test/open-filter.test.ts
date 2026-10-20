// @vitest-environment happy-dom

import { expect, test } from "vitest"
import "../src/main.ts"

function candidateTexts(): string[] {
  return [...document.querySelectorAll('[aria-label="候選"] li')].map((item) => item.textContent ?? "")
}

test("選了晶片分組後候選出現代號，點下去圖上有售價", () => {
  expect(candidateTexts()).toEqual([])

  const group = document.querySelector<HTMLSelectElement>('select[aria-label="晶片分組"]')
  expect(group).not.toBeNull()
  if (group === null) {
    return
  }
  group.value = "NVIDIA RTX4070"
  group.dispatchEvent(new Event("change", { bubbles: true }))

  expect(candidateTexts()).toEqual(["華碩 DUAL-RTX4070-O12G"])
  expect(document.body.textContent).not.toContain("2535MHz")

  const button = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  button?.click()

  const point = [...document.querySelectorAll("h2")]
    .find((node) => node.textContent === "價格序列")
    ?.parentElement
    ?.querySelector("li")
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
