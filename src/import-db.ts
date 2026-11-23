import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"
import pg from "pg"
import { isQuote } from "./quote.ts"
import { usedPostsFrom } from "./used-post.ts"

loadEnv()

const batchSize = 1000
const root = resolve(import.meta.dirname, "..")

type QuoteRow = {
  code: string
  date: string
  sellingPrice: number
  group: string
  rowText: string
  capturedAt: string
  rowIndex: number
  source: "估價頁" | "快照"
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim() ?? ""
  if (url !== "") {
    return url
  }
  console.error("缺少 DATABASE_URL。請在 .env 設定 Railway Postgres 連線字串後再跑。")
  process.exit(1)
}

function readJson(path: string): unknown {
  const text = readFileSync(path, "utf8")
  if (!text.startsWith("{") && !text.startsWith("[")) {
    console.error(`無法解析 JSON：${path}`)
    process.exit(1)
  }
  return JSON.parse(text) as unknown
}

function quotesFromFile(path: string): QuoteRow[] {
  const parsed = readJson(path)
  if (typeof parsed !== "object" || parsed === null || !("quotes" in parsed) || !Array.isArray(parsed.quotes)) {
    console.error(`檔案沒有 quotes 陣列：${path}`)
    process.exit(1)
  }
  const rows: QuoteRow[] = []
  for (const item of parsed.quotes) {
    if (isQuote(item)) {
      rows.push(item)
    }
  }
  return rows
}

async function applySchema(client: pg.Client): Promise<void> {
  const sql = readFileSync(resolve(root, "db/schema.sql"), "utf8")
  await client.query(sql)
}

async function upsertQuotes(client: pg.Client, table: "gpu_quotes" | "memory_quotes", rows: readonly QuoteRow[]): Promise<void> {
  console.log(`匯入 ${table}：${rows.length} 筆`)
  await client.query(`TRUNCATE ${table}`)
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const slice = rows.slice(offset, offset + batchSize)
    const values: unknown[] = []
    const placeholders: string[] = []
    for (const [index, row] of slice.entries()) {
      const base = index * 8
      placeholders.push(
        `($${base + 1}, $${base + 2}::date, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`,
      )
      values.push(row.code, row.date, row.sellingPrice, row.group, row.rowText, row.capturedAt, row.rowIndex, row.source)
    }
    await client.query(
      `INSERT INTO ${table} (code, quote_date, selling_price, chip_group, row_text, captured_at, row_index, source)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (code, quote_date) DO UPDATE SET
         selling_price = EXCLUDED.selling_price,
         chip_group = EXCLUDED.chip_group,
         row_text = EXCLUDED.row_text,
         captured_at = EXCLUDED.captured_at,
         row_index = EXCLUDED.row_index,
         source = EXCLUDED.source`,
      values,
    )
    console.log(`  ${table} ${Math.min(offset + batchSize, rows.length)}/${rows.length}`)
  }
}

async function upsertUsedPosts(client: pg.Client, path: string): Promise<void> {
  const posts = usedPostsFrom(readJson(path))
  console.log(`匯入 used_posts：${posts.length} 筆`)
  await client.query("TRUNCATE used_posts RESTART IDENTITY")
  for (let offset = 0; offset < posts.length; offset += batchSize) {
    const slice = posts.slice(offset, offset + batchSize)
    const values: unknown[] = []
    const placeholders: string[] = []
    for (const [index, post] of slice.entries()) {
      const base = index * 5
      placeholders.push(`($${base + 1}, $${base + 2}::date, $${base + 3}, $${base + 4}, $${base + 5})`)
      values.push(post.code, post.date, post.price, post.link, post.seller)
    }
    if (placeholders.length === 0) {
      continue
    }
    await client.query(
      `INSERT INTO used_posts (code, post_date, price, link, seller)
       VALUES ${placeholders.join(",")}
       ON CONFLICT (link, code, price) DO UPDATE SET
         post_date = EXCLUDED.post_date,
         seller = EXCLUDED.seller`,
      values,
    )
    console.log(`  used_posts ${Math.min(offset + batchSize, posts.length)}/${posts.length}`)
  }
}

async function seedIngestDone(client: pg.Client, kind: "gpu" | "memory", table: string): Promise<void> {
  await client.query(
    `INSERT INTO ingest_done (kind, captured_at)
     SELECT $1, captured_at FROM (SELECT DISTINCT captured_at FROM ${table}) AS d
     ON CONFLICT (kind, captured_at) DO NOTHING`,
    [kind],
  )
}

async function main(): Promise<void> {
  const url = databaseUrl()
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
  })
  await client.connect()
  console.log("已連上資料庫，套用 schema…")
  await applySchema(client)

  const gpuPath = resolve(root, "public/data/series.json")
  const memoryPath = resolve(root, "data/memory-series.json")
  const usedPath = resolve(root, "public/data/used.json")
  if (existsSync(gpuPath)) {
    await upsertQuotes(client, "gpu_quotes", quotesFromFile(gpuPath))
  }
  if (existsSync(memoryPath)) {
    await upsertQuotes(client, "memory_quotes", quotesFromFile(memoryPath))
  }
  if (existsSync(usedPath)) {
    await upsertUsedPosts(client, usedPath)
  }
  await seedIngestDone(client, "gpu", "gpu_quotes")
  await seedIngestDone(client, "memory", "memory_quotes")

  const counts = await client.query<{
    gpu: string
    memory: string
    used: string
    done: string
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM gpu_quotes) AS gpu,
      (SELECT COUNT(*)::text FROM memory_quotes) AS memory,
      (SELECT COUNT(*)::text FROM used_posts) AS used,
      (SELECT COUNT(*)::text FROM ingest_done) AS done
  `)
  const row = counts.rows[0]
  console.log(
    `完成：gpu_quotes=${row?.gpu ?? "0"} memory_quotes=${row?.memory ?? "0"} used_posts=${row?.used ?? "0"} ingest_done=${row?.done ?? "0"}`,
  )
  await client.end()
}

await main()
