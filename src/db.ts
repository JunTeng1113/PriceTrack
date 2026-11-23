import pg from "pg"
import type { PreparedSeries } from "./coolpc-daily.ts"
import type { PriceSeries } from "./present.ts"
import { isQuote } from "./quote.ts"
import type { UsedPost } from "./used-post.ts"

export type QuoteKind = "gpu" | "memory"

const quoteTable: Record<QuoteKind, string> = {
  gpu: "gpu_quotes",
  memory: "memory_quotes",
}

let pool: pg.Pool | null = null

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim() ?? ""
  if (url === "") {
    throw new Error("缺少 DATABASE_URL")
  }
  return url
}

export function getPool(): pg.Pool {
  if (pool !== null) {
    return pool
  }
  const url = databaseUrl()
  pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false },
    max: 4,
  })
  return pool
}

export async function closePool(): Promise<void> {
  if (pool === null) {
    return
  }
  await pool.end()
  pool = null
}

type QuoteRow = {
  code: string
  quote_date: string
  selling_price: number
  chip_group: string
  row_text: string
  captured_at: string
  row_index: number
  source: string
}

function toStoredQuote(row: QuoteRow): PriceSeries["quotes"][number] | null {
  const candidate = {
    code: row.code,
    date: row.quote_date instanceof Date
      ? row.quote_date.toISOString().slice(0, 10)
      : String(row.quote_date).slice(0, 10),
    sellingPrice: Number(row.selling_price),
    group: row.chip_group,
    rowText: row.row_text,
    capturedAt: row.captured_at,
    rowIndex: Number(row.row_index),
    source: row.source,
  }
  return isQuote(candidate) ? candidate : null
}

function quotesFromRows(rows: readonly QuoteRow[]): PriceSeries["quotes"][number][] {
  const quotes: PriceSeries["quotes"][number][] = []
  for (const row of rows) {
    const quote = toStoredQuote(row)
    if (quote !== null) {
      quotes.push(quote)
    }
  }
  return quotes
}

export async function loadQuotes(kind: QuoteKind): Promise<PriceSeries["quotes"][number][]> {
  const result = await getPool().query<QuoteRow>(
    `SELECT code, quote_date, selling_price, chip_group, row_text, captured_at, row_index, source
     FROM ${quoteTable[kind]}
     ORDER BY quote_date, code`,
  )
  return quotesFromRows(result.rows)
}

export async function listChipGroups(kind: QuoteKind): Promise<string[]> {
  const result = await getPool().query<{ chip_group: string }>(
    `SELECT DISTINCT chip_group FROM ${quoteTable[kind]} ORDER BY chip_group`,
  )
  return result.rows.map((row) => row.chip_group)
}

export async function loadQuotesByGroups(
  kind: QuoteKind,
  groups: readonly string[],
): Promise<PriceSeries["quotes"][number][]> {
  if (groups.length === 0) {
    return []
  }
  const result = await getPool().query<QuoteRow>(
    `SELECT code, quote_date, selling_price, chip_group, row_text, captured_at, row_index, source
     FROM ${quoteTable[kind]}
     WHERE chip_group = ANY($1::text[])
     ORDER BY quote_date, code`,
    [groups],
  )
  return quotesFromRows(result.rows)
}

export async function markIngestDone(kind: QuoteKind, capturedAt: string): Promise<void> {
  await getPool().query(
    `INSERT INTO ingest_done (kind, captured_at) VALUES ($1, $2)
     ON CONFLICT (kind, captured_at) DO NOTHING`,
    [kind, capturedAt],
  )
}

export async function replaceIngestDone(kind: QuoteKind, capturedAts: readonly string[]): Promise<void> {
  const client = await getPool().connect()
  try {
    await client.query("BEGIN")
    await client.query(`DELETE FROM ingest_done WHERE kind = $1`, [kind])
    for (let offset = 0; offset < capturedAts.length; offset += 1000) {
      const slice = capturedAts.slice(offset, offset + 1000)
      if (slice.length === 0) {
        continue
      }
      const values: unknown[] = []
      const placeholders: string[] = []
      for (const [index, capturedAt] of slice.entries()) {
        const base = index * 2
        placeholders.push(`($${base + 1}, $${base + 2})`)
        values.push(kind, capturedAt)
      }
      await client.query(
        `INSERT INTO ingest_done (kind, captured_at) VALUES ${placeholders.join(",")}
         ON CONFLICT (kind, captured_at) DO NOTHING`,
        values,
      )
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function loadPrepared(kind: QuoteKind): Promise<PreparedSeries> {
  const quotes = await loadQuotes(kind)
  const doneResult = await getPool().query<{ captured_at: string }>(
    `SELECT captured_at FROM ingest_done WHERE kind = $1
     UNION
     SELECT DISTINCT captured_at FROM ${quoteTable[kind]}
     ORDER BY 1`,
    [kind],
  )
  return {
    quotes,
    done: doneResult.rows.map((row) => row.captured_at),
  }
}

export async function upsertQuotes(
  kind: QuoteKind,
  quotes: readonly PriceSeries["quotes"][number][],
): Promise<void> {
  if (quotes.length === 0) {
    return
  }
  const client = await getPool().connect()
  const table = quoteTable[kind]
  const batchSize = 1000
  try {
    await client.query("BEGIN")
    for (let offset = 0; offset < quotes.length; offset += batchSize) {
      const slice = quotes.slice(offset, offset + batchSize)
      const values: unknown[] = []
      const placeholders: string[] = []
      for (const [index, row] of slice.entries()) {
        const base = index * 8
        placeholders.push(
          `($${base + 1}, $${base + 2}::date, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`,
        )
        values.push(
          row.code,
          row.date,
          row.sellingPrice,
          row.group,
          row.rowText,
          row.capturedAt,
          row.rowIndex,
          row.source,
        )
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
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function savePreparedDay(
  kind: QuoteKind,
  prepared: PreparedSeries,
  capturedAt: string,
): Promise<void> {
  const day = capturedAt.slice(0, 10)
  const dayQuotes = prepared.quotes.filter(
    (quote) => quote.capturedAt === capturedAt || quote.date === day,
  )
  await upsertQuotes(kind, dayQuotes)
  await markIngestDone(kind, capturedAt)
}

export async function replacePrepared(kind: QuoteKind, prepared: PreparedSeries): Promise<void> {
  const client = await getPool().connect()
  const table = quoteTable[kind]
  try {
    await client.query("BEGIN")
    await client.query(`TRUNCATE ${table}`)
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    client.release()
    throw error
  }
  client.release()
  await upsertQuotes(kind, prepared.quotes)
  await replaceIngestDone(kind, prepared.done)
}

type UsedRow = {
  code: string
  post_date: string | Date
  price: number
  link: string
  seller: string
}

function usedFromRows(rows: readonly UsedRow[]): UsedPost[] {
  return rows.map((row) => ({
    code: row.code,
    date: row.post_date instanceof Date ? row.post_date.toISOString().slice(0, 10) : String(row.post_date).slice(0, 10),
    price: Number(row.price),
    link: row.link,
    seller: row.seller,
  }))
}

export async function loadUsedPosts(): Promise<UsedPost[]> {
  const result = await getPool().query<UsedRow>(
    `SELECT code, post_date, price, link, seller FROM used_posts ORDER BY post_date, code, price`,
  )
  return usedFromRows(result.rows)
}

export async function loadUsedPostsByGroups(groups: readonly string[]): Promise<UsedPost[]> {
  if (groups.length === 0) {
    return []
  }
  const result = await getPool().query<UsedRow>(
    `SELECT DISTINCT u.code, u.post_date, u.price, u.link, u.seller
     FROM used_posts u
     INNER JOIN gpu_quotes g ON g.code = u.code
     WHERE g.chip_group = ANY($1::text[])
     ORDER BY u.post_date, u.code, u.price`,
    [groups],
  )
  return usedFromRows(result.rows)
}

export async function replaceUsedPosts(posts: readonly UsedPost[]): Promise<void> {
  const client = await getPool().connect()
  const batchSize = 1000
  try {
    await client.query("BEGIN")
    await client.query("TRUNCATE used_posts RESTART IDENTITY")
    for (let offset = 0; offset < posts.length; offset += batchSize) {
      const slice = posts.slice(offset, offset + batchSize)
      if (slice.length === 0) {
        continue
      }
      const values: unknown[] = []
      const placeholders: string[] = []
      for (const [index, post] of slice.entries()) {
        const base = index * 5
        placeholders.push(`($${base + 1}, $${base + 2}::date, $${base + 3}, $${base + 4}, $${base + 5})`)
        values.push(post.code, post.date, post.price, post.link, post.seller)
      }
      await client.query(
        `INSERT INTO used_posts (code, post_date, price, link, seller)
         VALUES ${placeholders.join(",")}
         ON CONFLICT (link, code, price) DO UPDATE SET
           post_date = EXCLUDED.post_date,
           seller = EXCLUDED.seller`,
        values,
      )
    }
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function mergeUsedPosts(posts: readonly UsedPost[]): Promise<number> {
  if (posts.length === 0) {
    return 0
  }
  const values: unknown[] = []
  const placeholders: string[] = []
  for (const [index, post] of posts.entries()) {
    const base = index * 5
    placeholders.push(`($${base + 1}, $${base + 2}::date, $${base + 3}, $${base + 4}, $${base + 5})`)
    values.push(post.code, post.date, post.price, post.link, post.seller)
  }
  const result = await getPool().query(
    `INSERT INTO used_posts (code, post_date, price, link, seller)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (link, code, price) DO NOTHING`,
    values,
  )
  return result.rowCount ?? 0
}
