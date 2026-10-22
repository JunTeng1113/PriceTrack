import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { visibleCodes, type PriceSeries } from "./present.ts"
import { addUsedPost, matchCodes, pickCode, usedPostFromFields, usedPostsFrom, type UsedPost } from "./used-post.ts"

const preparedPath = resolve("public/data/used.json")
const seriesPath = resolve("public/data/series.json")

async function readPosts(): Promise<UsedPost[]> {
  if (!existsSync(preparedPath)) {
    return []
  }
  const text = await readFile(preparedPath, "utf8")
  if (!text.startsWith("{")) {
    return []
  }
  return usedPostsFrom(JSON.parse(text))
}

async function save(posts: readonly UsedPost[]): Promise<void> {
  await mkdir(dirname(preparedPath), { recursive: true })
  const temporary = `${preparedPath}.tmp`
  await writeFile(temporary, `${JSON.stringify({ posts }, null, 2)}\n`)
  await rename(temporary, preparedPath)
}

async function readListingCodes(): Promise<string[]> {
  if (!existsSync(seriesPath)) {
    return []
  }
  const text = await readFile(seriesPath, "utf8")
  if (!text.startsWith("{")) {
    return []
  }
  const value: unknown = JSON.parse(text)
  if (typeof value !== "object" || value === null || !("quotes" in value) || !Array.isArray(value.quotes)) {
    return []
  }
  const quotes: PriceSeries["quotes"][number][] = []
  for (const quote of value.quotes) {
    const stored = storedQuote(quote)
    if (stored !== null) {
      quotes.push(stored)
    }
  }
  return visibleCodes({ quotes })
}

function storedQuote(value: unknown): PriceSeries["quotes"][number] | null {
  if (typeof value !== "object" || value === null) {
    return null
  }
  if (!("code" in value) || typeof value.code !== "string" || value.code === "") {
    return null
  }
  if (!("date" in value) || typeof value.date !== "string") {
    return null
  }
  if (!("sellingPrice" in value) || typeof value.sellingPrice !== "number") {
    return null
  }
  if (!("group" in value) || typeof value.group !== "string") {
    return null
  }
  if (!("rowText" in value) || typeof value.rowText !== "string") {
    return null
  }
  if (!("capturedAt" in value) || typeof value.capturedAt !== "string") {
    return null
  }
  if (!("rowIndex" in value) || typeof value.rowIndex !== "number") {
    return null
  }
  return {
    code: value.code,
    date: value.date,
    sellingPrice: value.sellingPrice,
    group: value.group,
    rowText: value.rowText,
    capturedAt: value.capturedAt,
    rowIndex: value.rowIndex,
  }
}

function printOptions(options: readonly string[]): void {
  for (let index = 0; index < options.length; index += 1) {
    const code = options[index]
    if (code !== undefined) {
      console.log(`${index + 1}. ${code}`)
    }
  }
}

const input = createInterface({ input: stdin, output: stdout })
const codes = await readListingCodes()
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
const fields = {
  code,
  date: await input.question("日期："),
  price: await input.question("二手開價："),
  link: await input.question("連結："),
}
input.close()

const post = usedPostFromFields(fields)
if (post === null) {
  console.error("這一筆不能記。要有代號、日期（YYYY-MM-DD、YYYY/M/D 或 YYYY年M月D日）、正整數金額，以及 http 或 https 連結。")
  process.exitCode = 1
} else {
  const posts = await readPosts()
  const next = addUsedPost(posts, post)
  if (next === null) {
    console.error("這個連結的這個代號和開價已經記過。")
    process.exitCode = 1
  } else {
    await save(next)
    console.log(`已記下 ${post.code} ${post.date} $${post.price}`)
  }
}
