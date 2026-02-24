/**
 * X (Twitter) API v2 — 投稿専用
 * 環境変数: X_API_KEY, X_API_SECRET, X_POSTER_ACCESS_TOKEN, X_POSTER_ACCESS_SECRET
 */

import { TwitterApi } from "twitter-api-v2";

function getPosterClient(): TwitterApi {
  const appKey = process.env.X_API_KEY;
  const appSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_POSTER_ACCESS_TOKEN;
  const accessSecret = process.env.X_POSTER_ACCESS_SECRET;
  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("X_API_KEY, X_API_SECRET, X_POSTER_ACCESS_TOKEN, X_POSTER_ACCESS_SECRET must be set");
  }
  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

export async function postTweet(text: string): Promise<{ id: string; text: string }> {
  const client = getPosterClient();
  const tweet = await client.v2.tweet(text);
  if (!tweet.data?.id) throw new Error("X tweet creation returned no id");
  return { id: tweet.data.id, text };
}

export async function postTweetWithMedia(
  text: string,
  mediaUrl: string
): Promise<{ id: string; text: string }> {
  if (!mediaUrl?.trim()) return postTweet(text);
  const imageRes = await fetch(mediaUrl);
  if (!imageRes.ok) return postTweet(text);
  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

  const client = getPosterClient();
  const mediaId = await client.v1.uploadMedia(imageBuffer, {
    mimeType: "image/png",
  });
  const tweet = await client.v2.tweet(text, {
    media: { media_ids: [mediaId] },
  });
  if (!tweet.data?.id) throw new Error("X tweet creation returned no id");
  return { id: tweet.data.id, text };
}
