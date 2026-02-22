/**
 * 投稿ソース
 */
export type PostSource = "x" | "truth_social";

/**
 * 処理ステータス
 * - pending: 取得直後・未処理
 * - translated: 翻訳・スクショ済み（X投稿前）
 * - posted: X投稿完了
 * - failed: いずれかで失敗
 */
export type PostStatus = "pending" | "translated" | "posted" | "failed";

/**
 * posts テーブルの行
 */
export interface Post {
  id: number;
  source: PostSource;
  original_id: string;
  content_text: string | null;
  translated_text: string | null;
  original_url: string | null;
  screenshot_url: string | null;
  status: PostStatus;
  fail_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 新規挿入用（id, created_at, updated_at はDBで生成）
 */
export type PostInsert = Omit<Post, "id" | "created_at" | "updated_at"> & {
  id?: number;
  created_at?: Date;
  updated_at?: Date;
};

/**
 * 部分更新用（Cron で status 等を更新）
 */
export type PostUpdate = Partial<
  Pick<
    Post,
    | "content_text"
    | "translated_text"
    | "original_url"
    | "screenshot_url"
    | "status"
    | "fail_count"
    | "updated_at"
  >
>;
