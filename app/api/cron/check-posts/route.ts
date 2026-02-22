import { NextRequest, NextResponse } from "next/server";
import {
  insertPostIfNotExists,
  getPendingPosts,
  getRetryPostCandidates,
  setPostTranslated,
  setPostPosted,
  setPostFailed,
} from "@/lib/db";
import { fetchTruthSocialFeed } from "@/lib/truth-social";
import {
  fetchUserTweets,
  resolveUserId,
  postTweetWithMedia,
} from "@/lib/x-api";
import { translateToJapanese } from "@/lib/deepl";
import { captureScreenshot } from "@/lib/screenshot";
import { uploadScreenshot } from "@/lib/storage";
import type { Post } from "@/lib/types";

const MAX_PROCESS_PER_RUN = Math.max(
  1,
  Math.min(10, Number(process.env.MAX_PROCESS_PER_RUN) || 2)
);

/**
 * Cron: 新着取得 → 未処理の翻訳・スクショ・X投稿
 * 認証: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = { fetched: { truth: 0, x: 0 }, processed: 0, retried: 0, errors: [] as string[] };

  try {
    // --- 1. 新着を DB に投入（冪等）---
    const truthItems = await fetchTruthSocialFeed().catch((e) => {
      summary.errors.push(`Truth Social: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    });
    for (const item of truthItems) {
      const inserted = await insertPostIfNotExists({
        source: "truth_social",
        original_id: item.id,
        content_text: item.content || item.title,
        original_url: item.link || null,
        status: "pending",
      });
      if (inserted != null) summary.fetched.truth += 1;
    }

    const targetUserId = process.env.X_TARGET_USER_ID;
    if (targetUserId) {
      const userId = /^\d+$/.test(targetUserId)
        ? targetUserId
        : await resolveUserId(targetUserId);
      const tweets = await fetchUserTweets(userId, 20).catch((e) => {
        summary.errors.push(`X fetch: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      });
      for (const t of tweets) {
        const inserted = await insertPostIfNotExists({
          source: "x",
          original_id: t.id,
          content_text: t.text,
          original_url: `https://x.com/i/status/${t.id}`,
          status: "pending",
        });
        if (inserted != null) summary.fetched.x += 1;
      }
    }

    // --- 2. 未処理 + リトライ候補を取得（合計 MAX_PROCESS_PER_RUN 件まで）---
    const pending = await getPendingPosts(MAX_PROCESS_PER_RUN);
    const retryLimit = Math.max(0, MAX_PROCESS_PER_RUN - pending.length);
    const retryCandidates = retryLimit > 0 ? await getRetryPostCandidates(retryLimit) : [];
    const toProcess: Post[] = [...pending, ...retryCandidates];

    for (const post of toProcess) {
      const isRetry = post.status === "failed";
      try {
        let translated = post.translated_text;
        let screenshotUrl = post.screenshot_url;

        if (!isRetry) {
          if (!post.content_text?.trim()) {
            await setPostFailed(post.id);
            summary.errors.push(`Post ${post.id}: empty content`);
            continue;
          }
          translated = await translateToJapanese(post.content_text);
          if (post.original_url) {
            const buffer = await captureScreenshot({
              url: post.original_url,
              width: 600,
              hideSelectors: ['[data-testid="login"]', ".overlay"],
            });
            const pathname = `screenshots/${post.source}-${post.original_id}-${Date.now()}.png`;
            screenshotUrl = await uploadScreenshot(buffer, pathname);
          }
          await setPostTranslated(post.id, translated, screenshotUrl);
        }

        if (!translated?.trim()) {
          await setPostFailed(post.id);
          summary.errors.push(`Post ${post.id}: no translation`);
          continue;
        }
        const mediaUrl = screenshotUrl || undefined;
        const text = mediaUrl
          ? `${translated}\n\n${post.original_url || ""}`
          : translated;
        await postTweetWithMedia(text, mediaUrl || "");
        await setPostPosted(post.id);
        if (isRetry) summary.retried += 1;
        else summary.processed += 1;
      } catch (e) {
        await setPostFailed(post.id);
        const msg = e instanceof Error ? e.message : String(e);
        summary.errors.push(`Post ${post.id}: ${msg}`);
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        ...summary,
        maxPerRun: MAX_PROCESS_PER_RUN,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    summary.errors.push(msg);
    return NextResponse.json(
      { ok: false, error: msg, summary },
      { status: 500 }
    );
  }
}
