# トランプ投稿・自動翻訳転送システム

Truth Social および X からドナルド・トランプ氏の投稿を取得し、日本語翻訳＋スクショ画像を添えて指定の X アカウントに自動投稿するシステムです。

## 技術スタック

- **Next.js** (App Router), TypeScript, Tailwind CSS
- **Vercel Postgres** (Neon), **Vercel Blob**
- **Vercel Cron Jobs**（10分間隔）

## セットアップ

### 1. 環境変数

`.env.example` をコピーして `.env.local` を作成し、各値を設定してください。

```bash
cp .env.example .env.local
```

必須の主な変数:

- `DATABASE_URL` … Vercel ダッシュボードの Storage（Neon）から取得
- `BLOB_READ_WRITE_TOKEN` … Vercel Storage の Blob から取得
- `X_API_KEY`, `X_API_SECRET`, `X_POSTER_ACCESS_TOKEN`, `X_POSTER_ACCESS_SECRET` … X Developer Portal で発行
- `X_TARGET_USER_ID` … 監視対象（例: `realDonaldTrump` または数値ID）
- `TRUTH_RSS_URL` … Truth Social 用 RSS フィード URL
- `DEEPL_API_KEY` … DeepL API
- `SCREENSHOT_API_KEY` … スクショAPI（Urlbox 等）のキー
- `CRON_SECRET` … Cron エンドポイント保護用（任意のランダム文字列）
- `MAX_PROCESS_PER_RUN` … 1回の実行で処理する最大件数（推奨: 1〜2）

### 2. データベース初期化

Vercel でプロジェクトをリンクしたあと、Neon の SQL エディタ（または Vercel Dashboard → Storage → Postgres）で `schema/init.sql` の内容を実行してください。

### 3. 開発・ビルド

```bash
npm install
npm run dev    # 開発サーバー
npm run build  # 本番ビルド
```

### 4. Cron の保護

本番では `CRON_SECRET` を設定し、Vercel Cron の「Authorization: Bearer \<CRON_SECRET\>」が送られるようにしてください。未設定の場合は認証をスキップします。

## ディレクトリ構成

- `app/api/cron/check-posts/` … 定期実行されるメイン API
- `lib/db.ts` … データベース（Neon）
- `lib/x-api.ts` … X 取得・投稿
- `lib/deepl.ts` … 翻訳
- `lib/truth-social.ts` … Truth Social RSS 取得
- `lib/screenshot.ts` … スクショ API
- `lib/storage.ts` … Vercel Blob 保存
- `schema/init.sql` … テーブル定義

## 動作フロー

1. **Cron** が約10分ごとに `/api/cron/check-posts` を呼ぶ
2. **取得**: Truth Social（RSS）と X（API）から新着を取得し、重複しなければ `posts` に `pending` で挿入
3. **処理**: `pending` を最大 `MAX_PROCESS_PER_RUN` 件まで処理  
   - DeepL で日本語翻訳  
   - スクショ API で元投稿の画像取得 → Vercel Blob に保存  
   - status を `translated` に更新
4. **投稿**: X API で「日本語訳テキスト ＋ スクショ画像」を投稿し、status を `posted` に更新
5. **リトライ**: `failed` かつ翻訳済みの行は、次回 Cron で投稿のみ再試行
