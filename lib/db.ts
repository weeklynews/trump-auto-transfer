import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import type { Post, PostInsert } from "./types";

let _sql: NeonQueryFunction<false, false> | null = null;
function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

/**
 * 既に (source, original_id) が存在するか
 */
export async function existsBySourceAndOriginalId(
  source: Post["source"],
  originalId: string
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT 1 FROM posts
    WHERE source = ${source} AND original_id = ${originalId}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * 新規投稿を1件挿入（重複時は何もしない）
 * 戻り値: 挿入した行の id、重複の場合は null
 */
export async function insertPostIfNotExists(
  row: PostInsert
): Promise<number | null> {
  const sql = getSql();
  const result = await sql`
    INSERT INTO posts (source, original_id, content_text, translated_text, original_url, screenshot_url, status, fail_count)
    VALUES (
      ${row.source},
      ${row.original_id},
      ${row.content_text ?? null},
      ${row.translated_text ?? null},
      ${row.original_url ?? null},
      ${row.screenshot_url ?? null},
      ${row.status ?? "pending"},
      ${row.fail_count ?? 0}
    )
    ON CONFLICT (source, original_id) DO NOTHING
    RETURNING id
  `;
  const id = result?.[0]?.id;
  return id != null ? Number(id) : null;
}

/**
 * status が pending の行を取得（古い順、上限付き）
 */
export async function getPendingPosts(limit: number): Promise<Post[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, source, original_id, content_text, translated_text, original_url, screenshot_url, status, fail_count, created_at, updated_at
    FROM posts
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows as Post[];
}

/**
 * status = 'failed' かつ translated_text が存在する行（投稿のみリトライ）
 */
export async function getRetryPostCandidates(limit: number): Promise<Post[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, source, original_id, content_text, translated_text, original_url, screenshot_url, status, fail_count, created_at, updated_at
    FROM posts
    WHERE status = 'failed' AND translated_text IS NOT NULL AND translated_text != ''
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `;
  return rows as Post[];
}

/**
 * status を translated にし、翻訳文・スクショURLを保存
 */
export async function setPostTranslated(
  id: number,
  translated_text: string,
  screenshot_url: string | null
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE posts
    SET status = 'translated', translated_text = ${translated_text}, screenshot_url = ${screenshot_url}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * status を posted に更新（完了）
 */
export async function setPostPosted(id: number): Promise<void> {
  const sql = getSql();
  await sql`UPDATE posts SET status = 'posted', updated_at = NOW() WHERE id = ${id}`;
}

/**
 * status を failed にし、fail_count をインクリメント
 */
export async function setPostFailed(id: number): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE posts
    SET status = 'failed', fail_count = fail_count + 1, updated_at = NOW()
    WHERE id = ${id}
  `;
}
