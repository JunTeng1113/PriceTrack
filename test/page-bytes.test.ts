import { describe, expect, test } from "vitest"
import { decodePage } from "../src/page-bytes.ts"

const big5Label = Uint8Array.from([197, 227, 165, 220, 165, 100, 86, 71, 65])

describe("估價頁位元組", () => {
  test("charset=big5 的頁面解出顯示卡VGA", () => {
    const prefix = new TextEncoder().encode("<meta charset=big5>")
    const bytes = new Uint8Array(prefix.length + big5Label.length)
    bytes.set(prefix)
    bytes.set(big5Label, prefix.length)

    expect(decodePage(bytes, "")).toContain("顯示卡VGA")
  })

  test("沒有 Big5 標記時依 UTF-8 解碼", () => {
    const bytes = new TextEncoder().encode("顯示卡VGA")

    expect(decodePage(bytes, "text/html; charset=utf-8")).toBe("顯示卡VGA")
  })
})
