-- トランプ投稿・自動翻訳転送システム用 posts テーブル
-- Vercel Postgres (Neon) で実行する初期化SQL

CREATE TABLE IF NOT EXISTS posts (
  id            BIGSERIAL PRIMARY KEY,
  source         TEXT NOT NULL CHECK (source IN ('x', 'truth_social')),
  original_id    TEXT NOT NULL,
  content_text   TEXT,
  translated_text TEXT,
  original_url   TEXT,
  screenshot_url TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'translated', 'posted', 'failed')),
  fail_count     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, original_id)
);

-- 重複取得・二重投稿防止のためのインデックス
CREATE INDEX IF NOT EXISTS idx_posts_source_original_id ON posts (source, original_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);

-- updated_at 自動更新（任意）
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();
