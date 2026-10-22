import { describe, expect, test } from "vitest"
import { addUsedPost, matchCodes, pickCode, usedBoxes, usedPostFromFields, usedPostsFrom, type UsedPost } from "../src/used-post.ts"

const fields = {
  code: "華碩 TUF-RTX4070-O12G",
  date: "2024-06-15",
  price: "12000",
  link: "https://example.com/post/1",
}

const knownCodes = [
  "華碩 DUAL-RTX5060-O8G",
  "華碩 DUAL-RTX5060TI-O8G",
  "技嘉 RTX5060 WINDFORCE 8G",
  "華碩 TUF-RTX4070-O12G",
]

describe("代號片段", () => {
  test("dual 5060 對上同時含這兩個片段的代號", () => {
    expect(matchCodes("dual 5060", knownCodes)).toEqual({
      status: "choose",
      options: ["華碩 DUAL-RTX5060-O8G", "華碩 DUAL-RTX5060TI-O8G"],
    })
  })

  test("沒有符合的代號時不給選項", () => {
    expect(matchCodes("sapphire", knownCodes)).toEqual({ status: "none" })
    expect(matchCodes("   ", knownCodes)).toEqual({ status: "none" })
  })

  test("超過 20 筆時只列出前 20 筆並要求縮小", () => {
    const codes = Array.from({ length: 21 }, (_, index) => `華碩 DUAL-RTX5060-${index}`)
    expect(matchCodes("dual 5060", codes)).toEqual({
      status: "narrow",
      options: codes.slice(0, 20),
    })
    expect(matchCodes("dual 5060", codes.slice(0, 20)).status).toBe("choose")
  })

  test("華碩、技嘉、微星可以用英文別名對上", () => {
    const codes = [
      "華碩 DUAL-RTX5060-O8G",
      "技嘉 RTX5060 WINDFORCE 8G",
      "微星 RTX5060 8G VENTUS 2X",
      "ROG-STRIX-RTX5070TI-16G-GAMING",
    ]
    expect(matchCodes("ASUS dual 5060", codes)).toEqual({
      status: "choose",
      options: ["華碩 DUAL-RTX5060-O8G"],
    })
    expect(matchCodes("gigabyte 5060", codes)).toEqual({
      status: "choose",
      options: ["技嘉 RTX5060 WINDFORCE 8G"],
    })
    expect(matchCodes("msi 5060", codes)).toEqual({
      status: "choose",
      options: ["微星 RTX5060 8G VENTUS 2X"],
    })
    expect(matchCodes("asus", codes)).toEqual({
      status: "choose",
      options: ["華碩 DUAL-RTX5060-O8G", "ROG-STRIX-RTX5070TI-16G-GAMING"],
    })
  })

  test("連字號不使片段對不到，選項仍是代號原文", () => {
    expect(matchCodes("rtx5060", ["ZOTAC RTX-5060"])).toEqual({
      status: "choose",
      options: ["ZOTAC RTX-5060"],
    })
  })

  test("編號確認後才是要記的代號", () => {
    const options = ["華碩 DUAL-RTX5060-O8G", "華碩 DUAL-RTX5060TI-O8G"]
    expect(pickCode(options, "1")).toBe("華碩 DUAL-RTX5060-O8G")
    expect(pickCode(options, "2")).toBe("華碩 DUAL-RTX5060TI-O8G")
    expect(pickCode(options, "0")).toBeNull()
    expect(pickCode(options, "3")).toBeNull()
    expect(pickCode(["華碩 DUAL-RTX5060-O8G"], "")).toBeNull()
  })
})

describe("二手貼文", () => {
  test("四個欄位都有效時記成一筆", () => {
    expect(usedPostFromFields(fields)).toEqual({
      code: "華碩 TUF-RTX4070-O12G",
      date: "2024-06-15",
      price: 12000,
      link: "https://example.com/post/1",
    })
  })

  test("日期可以用斜線、中文或含空格，並存成 YYYY-MM-DD", () => {
    const dated = (date: string) => usedPostFromFields({ ...fields, date })
    expect(dated("2024/06/15")?.date).toBe("2024-06-15")
    expect(dated("2024/6/5")?.date).toBe("2024-06-05")
    expect(dated("2024年06月15日")?.date).toBe("2024-06-15")
    expect(dated("2024年6月5日")?.date).toBe("2024-06-05")
    expect(dated("2024 年 06 月 15 日")?.date).toBe("2024-06-15")
    expect(dated(" 2024 / 6 / 5 ")?.date).toBe("2024-06-05")
    expect(dated("2024/02/31")).toBeNull()
    expect(dated("10/22/2024")).toBeNull()
  })

  test("日期、金額或連結無效時不記", () => {
    expect(usedPostFromFields({ ...fields, date: "2024-02-31" })).toBeNull()
    expect(usedPostFromFields({ ...fields, price: "0" })).toBeNull()
    expect(usedPostFromFields({ ...fields, price: "12,000" })).toBeNull()
    expect(usedPostFromFields({ ...fields, link: "example.com/post" })).toBeNull()
    expect(usedPostFromFields({ ...fields, code: "  " })).toBeNull()
  })

  test("同一個連結可以記不同代號或不同開價", () => {
    const post = usedPostFromFields(fields)
    expect(post).not.toBeNull()
    if (post === null) {
      return
    }
    const otherCode = { ...post, code: "技嘉 RTX4070 WINDFORCE 12G" }
    const otherPrice = { ...post, price: 11000 }
    expect(addUsedPost([post], otherCode)).toEqual([post, otherCode])
    expect(addUsedPost([post], otherPrice)).toEqual([post, otherPrice])
    expect(addUsedPost([post], { ...post, date: "2024-06-16" })).toBeNull()
    expect(addUsedPost([], post)).toEqual([post])
  })
})

function post(code: string, date: string, price: number): UsedPost {
  return { code, date, price, link: `https://example.com/${code}/${date}/${price}` }
}

describe("二手行情", () => {
  test("一筆、兩筆、五筆的四分位", () => {
    const one = usedBoxes([post("A", "2024-06-15", 12000)], ["A"], { start: "2024-06-01", end: "2024-06-30" })
    expect(one).toEqual([{ code: "A", min: 12000, q1: 12000, median: 12000, q3: 12000, max: 12000, posts: [post("A", "2024-06-15", 12000)] }])

    const two = usedBoxes(
      [post("A", "2024-06-15", 14000), post("A", "2024-06-16", 10000)],
      ["A"],
      { start: "2024-06-01", end: "2024-06-30" },
    )
    expect(two[0]).toMatchObject({ min: 10000, q1: 10000, median: 12000, q3: 14000, max: 14000 })

    const five = usedBoxes(
      [10000, 11000, 12000, 13000, 14000].map((price, index) => post("A", `2024-06-1${index + 1}`, price)),
      ["A"],
      { start: "2024-06-01", end: "2024-06-30" },
    )
    expect(five[0]).toMatchObject({ min: 10000, q1: 10500, median: 12000, q3: 13500, max: 14000 })
  })

  test("同一個代號在區間裡的多日開價合成一盒", () => {
    const prices = Array.from({ length: 15 }, (_, index) => index + 1)
    const posts = prices.map((price, index) => post("A", `2024-06-${String(19 + Math.floor(index / 5)).padStart(2, "0")}`, price))
    const boxes = usedBoxes(
      [...posts, post("A", "2024-07-01", 99), post("B", "2024-06-19", 50)],
      ["B", "A"],
      { start: "2024-06-19", end: "2024-06-21" },
    )
    expect(boxes.map((box) => box.code)).toEqual(["B", "A"])
    expect(boxes[1]).toMatchObject({ min: 1, q1: 4, median: 8, q3: 12, max: 15, posts })
  })

  test("讀檔時略過不完整的紀錄", () => {
    expect(usedPostsFrom({ posts: [post("A", "2024-06-15", 12000), { code: "B" }] })).toEqual([
      post("A", "2024-06-15", 12000),
    ])
    expect(usedPostsFrom(null)).toEqual([])
  })
})
