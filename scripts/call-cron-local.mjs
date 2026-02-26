/**
 * .env.local を読み込み、ローカルの /api/cron/check-posts を呼び出す（原因調査用）
 * 使い方: node scripts/call-cron-local.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env.local");

function loadEnvLocal() {
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch (e) {
    console.error(".env.local の読み込みに失敗しました:", e.message);
    process.exit(1);
  }
}

loadEnvLocal();
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET が .env.local にありません");
  process.exit(1);
}

const url = "http://localhost:3000/api/cron/check-posts";
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});
const text = await res.text();
console.log("Status:", res.status);
console.log("Body:", text);
