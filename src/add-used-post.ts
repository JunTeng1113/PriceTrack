import { config as loadEnv } from "dotenv"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { closePool, loadQuotes, loadUsedPosts, replaceUsedPosts } from "./db.ts"
import { visibleCodes } from "./present.ts"
import {
  addUsedPost,
  isHttpLink,
  matchCodes,
  pickCode,
  sellerListings,
  usedPostFromFields,
} from "./used-post.ts"

loadEnv()

function printOptions(options: readonly string[]): void {
  for (let index = 0; index < options.length; index += 1) {
    const code = options[index]
    if (code !== undefined) {
      console.log(`${index + 1}. ${code}`)
    }
  }
}

const input = createInterface({ input: stdin, output: stdout })
const codes = visibleCodes({ quotes: await loadQuotes("gpu") })
let code = ""
while (code === "") {
  const query = await input.question("代號：")
  const match = matchCodes(query, codes)
  if (match.status === "none") {
    console.error("沒有符合的代號。")
    continue
  }
  printOptions(match.options)
  if (match.status === "narrow") {
    console.error("符合的代號太多，請再縮小片段。")
    continue
  }
  const chosen = pickCode(match.options, await input.question("編號："))
  if (chosen === null) {
    console.error("請輸入選項編號。")
    continue
  }
  code = chosen
}
let seller = ""
while (seller === "") {
  const entry = (await input.question("賣家個人網址：")).trim()
  if (isHttpLink(entry)) {
    seller = entry
    continue
  }
  console.error("賣家個人網址要是 http 或 https。")
}
const posts = await loadUsedPosts()
const existing = sellerListings(posts, seller, code)
let proceed = true
if (existing.length > 0) {
  console.error(`這個賣家的這個代號已經有 ${existing.length} 筆。`)
  for (const item of existing) {
    console.error(`${item.date} $${item.price} ${item.link}`)
  }
  let answer = ""
  while (answer !== "是" && answer !== "否") {
    const entry = (await input.question("是否繼續輸入？（是/否）：")).trim()
    answer = entry === "" ? "否" : entry
  }
  proceed = answer === "是"
}
if (!proceed) {
  input.close()
  console.log("未記下。")
  await closePool()
} else {
  const fields = {
    code,
    date: await input.question("日期："),
    price: await input.question("二手開價："),
    link: await input.question("連結："),
    seller,
  }
  input.close()

  const post = usedPostFromFields(fields)
  if (post === null) {
    console.error("這一筆不能記。要有代號、日期（YYYYMMDD、YYYY-MM-DD、YYYY/M/D 或 YYYY年M月D日）、正整數金額，以及貼文連結和賣家個人網址（皆為 http 或 https）。")
    process.exitCode = 1
    await closePool()
  } else {
    const next = addUsedPost(posts, post)
    if (next === null) {
      console.error("這個連結的這個代號和開價已經記過。")
      process.exitCode = 1
      await closePool()
    } else {
      await replaceUsedPosts(next)
      console.log(`已寫入資料庫 ${post.code} ${post.date} $${post.price}`)
      await closePool()
    }
  }
}
