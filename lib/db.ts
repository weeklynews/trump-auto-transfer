import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import type { Post, PostInsert } from "./types";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: pg.Pool;
};

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    if (!globalForPrisma.prismaPool) {
      globalForPrisma.prismaPool = new pg.Pool({ connectionString: url });
    }
    const adapter = new PrismaPg(globalForPrisma.prismaPool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function withDbContext<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`[DB:${operation}] ${toErrorMessage(err)}`);
  }
}

function toPost(row: {
  id: bigint;
  source: string;
  originalId: string;
  contentText: string | null;
  translatedText: string | null;
  originalUrl: string | null;
  screenshotUrl: string | null;
  status: string;
  failCount: number;
  createdAt: Date;
  updatedAt: Date;
}): Post {
  return {
    id: Number(row.id),
    source: row.source as Post["source"],
    original_id: row.originalId,
    content_text: row.contentText,
    translated_text: row.translatedText,
    original_url: row.originalUrl,
    screenshot_url: row.screenshotUrl,
    status: row.status as Post["status"],
    fail_count: row.failCount,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

/**
 * 既に (source, original_id) が存在するか
 */
export async function existsBySourceAndOriginalId(
  source: Post["source"],
  originalId: string
): Promise<boolean> {
  return withDbContext("existsBySourceAndOriginalId", async () => {
    const prisma = getPrisma();
    const row = await prisma.post.findFirst({
      where: { source, originalId },
      select: { id: true },
    });
    return row != null;
  });
}

/**
 * 新規投稿を1件挿入（重複時は何もしない）
 * 戻り値: 挿入した行の id、重複の場合は null
 */
export async function insertPostIfNotExists(
  row: PostInsert
): Promise<number | null> {
  return withDbContext("insertPostIfNotExists", async () => {
    const prisma = getPrisma();
    try {
      const created = await prisma.post.create({
        data: {
          source: row.source,
          originalId: row.original_id,
          contentText: row.content_text ?? null,
          translatedText: row.translated_text ?? null,
          originalUrl: row.original_url ?? null,
          screenshotUrl: row.screenshot_url ?? null,
          status: row.status ?? "pending",
          failCount: row.fail_count ?? 0,
        },
        select: { id: true },
      });
      return Number(created.id);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
        return null;
      }
      throw err;
    }
  });
}

/**
 * status が pending の行を取得（古い順、上限付き）
 */
export async function getPendingPosts(limit: number): Promise<Post[]> {
  return withDbContext("getPendingPosts", async () => {
    const prisma = getPrisma();
    const rows = await prisma.post.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map(toPost);
  });
}

/**
 * status = 'failed' かつ translated_text が存在する行（投稿のみリトライ）
 */
export async function getRetryPostCandidates(limit: number): Promise<Post[]> {
  return withDbContext("getRetryPostCandidates", async () => {
    const prisma = getPrisma();
    const rows = await prisma.post.findMany({
      where: {
        status: "failed",
        translatedText: { not: null },
        NOT: { translatedText: "" },
      },
      orderBy: { updatedAt: "asc" },
      take: limit,
    });
    return rows.map(toPost);
  });
}

/**
 * status を translated にし、翻訳文・スクショURLを保存
 */
export async function setPostTranslated(
  id: number,
  translated_text: string,
  screenshot_url: string | null
): Promise<void> {
  await withDbContext("setPostTranslated", async () => {
    const prisma = getPrisma();
    await prisma.post.update({
      where: { id: BigInt(id) },
      data: {
        status: "translated",
        translatedText: translated_text,
        screenshotUrl: screenshot_url,
      },
    });
  });
}

/**
 * status を posted に更新（完了）
 */
export async function setPostPosted(id: number): Promise<void> {
  await withDbContext("setPostPosted", async () => {
    const prisma = getPrisma();
    await prisma.post.update({
      where: { id: BigInt(id) },
      data: { status: "posted" },
    });
  });
}

/**
 * status を failed にし、fail_count をインクリメント
 */
export async function setPostFailed(id: number): Promise<void> {
  await withDbContext("setPostFailed", async () => {
    const prisma = getPrisma();
    await prisma.post.update({
      where: { id: BigInt(id) },
      data: {
        status: "failed",
        failCount: { increment: 1 },
      },
    });
  });
}
