import { describe, expect, test } from "vitest"
import { addUsedPost, usedPostFromFields } from "../src/used-post.ts"

const fields = {
  code: "華碩 TUF-RTX4070-O12G",
  date: "2024-06-15",
  price: "12000",
  link: "https://example.com/post/1",
}

describe("二手貼文", () => {
  test("四個欄位都有效時記成一筆", () => {
    expect(usedPostFromFields(fields)).toEqual({
      code: "華碩 TUF-RTX4070-O12G",
      date: "2024-06-15",
      price: 12000,
      link: "https://example.com/post/1",
    })
  })

  test("日期、金額或連結無效時不記", () => {
    expect(usedPostFromFields({ ...fields, date: "2024-02-31" })).toBeNull()
    expect(usedPostFromFields({ ...fields, price: "0" })).toBeNull()
    expect(usedPostFromFields({ ...fields, price: "12,000" })).toBeNull()
    expect(usedPostFromFields({ ...fields, link: "example.com/post" })).toBeNull()
    expect(usedPostFromFields({ ...fields, code: "  " })).toBeNull()
  })

  test("同一個連結只留一筆", () => {
    const post = usedPostFromFields(fields)
    expect(post).not.toBeNull()
    if (post === null) {
      return
    }
    expect(addUsedPost([post], { ...post, price: 11000 })).toBeNull()
    expect(addUsedPost([], post)).toEqual([post])
  })
})
