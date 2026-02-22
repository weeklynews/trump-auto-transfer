/**
 * X (Twitter) API v2
 * - 監視対象ユーザーの最新投稿を取得
 * - 指定アカウントでメディア付き投稿
 * 環境変数: X_API_KEY, X_API_SECRET, X_POSTER_ACCESS_TOKEN, X_POSTER_ACCESS_SECRET, X_TARGET_USER_ID
 */

import { TwitterApi } from "twitter-api-v2";

const TWITTER_API = "https://api.twitter.com/2";

export interface XPost {
  id: string;
  text: string;
  created_at?: string;
}

/** 投稿用 OAuth 1.0a クライアント（ユーザーコンテキスト） */
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

/** Bearer トークン（アプリのみ・読み取り用） */
async function getBearerToken(): Promise<string> {
  const key = process.env.X_API_KEY;
  const secret = process.env.X_API_SECRET;
  if (!key || !secret) throw new Error("X_API_KEY / X_API_SECRET not set");
  const credentials = Buffer.from(
    `${encodeURIComponent(key)}:${encodeURIComponent(secret)}`
  ).toString("base64");
  const res = await fetch("https://api.twitter.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`X token error: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * 監視対象ユーザーの直近ツイートを取得
 */
export async function fetchUserTweets(
  userId: string,
  maxResults: number = 10
): Promise<XPost[]> {
  const token = await getBearerToken();
  const params = new URLSearchParams({
    max_results: String(maxResults),
    "tweet.fields": "created_at,text",
    exclude: "replies,retweets",
  });
  const res = await fetch(
    `${TWITTER_API}/users/${userId}/tweets?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`X fetch tweets error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    data?: { id: string; text: string; created_at?: string }[];
  };
  const list = data.data ?? [];
  return list.map((t) => ({
    id: t.id,
    text: t.text,
    created_at: t.created_at,
  }));
}

/**
 * スクリーンネームでユーザーIDを解決
 */
export async function resolveUserId(screenName: string): Promise<string> {
  const token = await getBearerToken();
  const res = await fetch(
    `${TWITTER_API}/users/by/username/${encodeURIComponent(screenName)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`X resolve user error: ${res.status}`);
  const data = (await res.json()) as { data?: { id: string } };
  if (!data.data?.id) throw new Error("X user not found");
  return data.data.id;
}

/**
 * テキストのみでツイート
 */
export async function postTweet(text: string): Promise<{ id: string; text: string }> {
  const client = getPosterClient();
  const tweet = await client.v2.tweet(text);
  if (!tweet.data?.id) throw new Error("X tweet creation returned no id");
  return { id: tweet.data.id, text };
}

/**
 * 画像URLを取得してメディア付きでツイート（画像取得に失敗した場合はテキストのみ）
 */
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
