import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { addUsedPost, usedPostFromFields, type UsedPost } from "./used-post.ts"

const preparedPath = resolve("public/data/used.json")

function isUsedPost(value: unknown): value is UsedPost {
  if (typeof value !== "object" || value === null) {
    return false
  }
  return "code" in value && typeof value.code === "string"
    && "date" in value && typeof value.date === "string"
    && "price" in value && typeof value.price === "number"
    && "link" in value && typeof value.link === "string"
}

function postsFrom(value: unknown): UsedPost[] {
  if (typeof value !== "object" || value === null || !("posts" in value) || !Array.isArray(value.posts)) {
    return []
  }
  return value.posts.filter(isUsedPost)
}

async function readPosts(): Promise<UsedPost[]> {
  if (!existsSync(preparedPath)) {
    return []
  }
  const text = await readFile(preparedPath, "utf8")
  if (!text.startsWith("{")) {
    return []
  }
  return postsFrom(JSON.parse(text))
}

async function save(posts: readonly UsedPost[]): Promise<void> {
  await mkdir(dirname(preparedPath), { recursive: true })
  const temporary = `${preparedPath}.tmp`
  await writeFile(temporary, `${JSON.stringify({ posts }, null, 2)}\n`)
  await rename(temporary, preparedPath)
}

const input = createInterface({ input: stdin, output: stdout })
const fields = {
  code: await input.question("代號："),
  date: await input.question("日期："),
  price: await input.question("二手開價："),
  link: await input.question("連結："),
}
input.close()

const post = usedPostFromFields(fields)
if (post === null) {
  console.error("這一筆不能記。要有代號、YYYY-MM-DD 日期、正整數金額，以及 http 或 https 連結。")
  process.exitCode = 1
} else {
  const posts = await readPosts()
  const next = addUsedPost(posts, post)
  if (next === null) {
    console.error("這個連結已經記過。")
    process.exitCode = 1
  } else {
    await save(next)
    console.log(`已記下 ${post.code} ${post.date} $${post.price}`)
  }
}
