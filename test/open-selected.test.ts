// @vitest-environment happy-dom

import { expect, test } from "vitest"
import "../src/main.ts"

function sectionByHeading(heading: string): HTMLElement | null {
  const found = [...document.querySelectorAll("h2")].find((node) => node.textContent === heading)
  if (found === undefined || found.parentElement === null) {
    return null
  }
  return found.parentElement
}

test("拿掉已選、取消候選勾選，並點圖上的點讀數", () => {
  expect(localStorage.length).toBe(0)
  expect(document.body.textContent).not.toContain("登入")
  expect(document.body.textContent).not.toContain("收藏")
  expect(document.querySelectorAll('[aria-label="已選"] li')).toHaveLength(0)

  expect(sectionByHeading("篩選")).not.toBeNull()
  expect(sectionByHeading("價格序列")).toBeNull()

  const group = [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')]
    .find((item) => item.textContent === "NVIDIA RTX4070")
  group?.click()
  document.querySelector<HTMLButtonElement>('button[aria-label="搜尋"]')?.click()
  document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')?.click()

  expect(document.querySelector('[aria-label="已選"] li span')?.textContent).toBe("華碩 DUAL-RTX4070-O12G")

  document.querySelector<HTMLButtonElement>('[aria-label="已選"] button')?.click()
  expect(document.querySelectorAll('[aria-label="已選"] li')).toHaveLength(0)
  expect(sectionByHeading("價格序列")).toBeNull()

  const candidate = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  expect(candidate?.getAttribute("aria-pressed")).toBe("false")
  candidate?.click()

  expect(document.querySelector('[aria-label="讀數"]')).toBeNull()

  const checked = document.querySelector<HTMLButtonElement>('[aria-label="候選"] button')
  expect(checked?.getAttribute("aria-pressed")).toBe("true")
  checked?.click()
  expect(document.querySelectorAll('[aria-label="已選"] li')).toHaveLength(0)
  expect(localStorage.length).toBe(0)
})
