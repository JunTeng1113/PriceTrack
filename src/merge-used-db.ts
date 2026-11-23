import { config as loadEnv } from "dotenv"
import { readFileSync } from "node:fs"
import { closePool, mergeUsedPosts } from "./db.ts"
import { usedPostsFrom } from "./used-post.ts"

loadEnv()

const path = process.argv[2]
const text = path === undefined || path === "-"
  ? readFileSync(0, "utf8")
  : readFileSync(path, "utf8")
if (!text.trim().startsWith("{")) {
  console.error("需要 { posts: [...] } JSON")
  process.exitCode = 1
} else {
  const posts = usedPostsFrom(JSON.parse(text))
  const inserted = await mergeUsedPosts(posts)
  console.log(`合併 ${posts.length} 筆，新增 ${inserted} 筆到資料庫`)
}

await closePool()
