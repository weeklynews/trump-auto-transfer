/**
 * schema/init.sql を Prisma Postgres に適用する
 * 使い方: .env.local に DATABASE_URL を設定してから
 *   node scripts/run-init-sql.mjs
 * または
 *   npm run db:init
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// .env.local を読む（Node 組み込みでは --env-file が Node 20.6+）
function loadEnvLocal() {
  try {
    const path = join(root, ".env.local");
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    console.warn(".env.local が見つかりません。環境変数 DATABASE_URL を設定してください。");
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL が未設定です。Vercel から取得するか .env.local に書いてください。");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// init.sql を文ごとに分割（$$...$$ 内の ; は区切りにしない）
const initPath = join(root, "schema", "init.sql");
let text = readFileSync(initPath, "utf8");
// コメント行を除去（-- で始まる行）
text = text.replace(/^--.*$/gm, "");
const statements = [];
let current = "";
let inDollar = false;
for (const line of text.split("\n")) {
  if (line.includes("$$")) inDollar = !inDollar;
  current += line + "\n";
  if (!inDollar && line.trim().endsWith(";")) {
    statements.push(current.trim());
    current = "";
  }
}
if (current.trim()) statements.push(current.trim());

async function main() {
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    if (!s) continue;
    try {
      await prisma.$executeRawUnsafe(s);
      console.log(`[OK] 文 ${i + 1}/${statements.length}`);
    } catch (err) {
      console.error(`[ERR] 文 ${i + 1}:`, err.message);
      throw err;
    }
  }
  await prisma.$disconnect();
  await pool.end();
  console.log("init.sql の適用が完了しました。");
}

main().catch((e) => {
  console.error(e);
  pool.end().catch(() => {});
  process.exit(1);
});
