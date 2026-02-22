/**
 * Truth Social からの投稿取得（RSS フィード）
 * 環境変数: TRUTH_RSS_URL
 */

export interface TruthSocialItem {
  id: string;
  title: string;
  content: string;
  link: string;
  pubDate: string;
}

/**
 * RSS フィードをパースして新着投稿リストを返す
 */
export async function fetchTruthSocialFeed(): Promise<TruthSocialItem[]> {
  const url = process.env.TRUTH_RSS_URL;
  if (!url) {
    throw new Error("TRUTH_RSS_URL is not set");
  }
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { "User-Agent": "TrumpAutoTransfer/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Truth Social RSS error: ${res.status}`);
  }
  const xml = await res.text();
  return parseRssItems(xml);
}

/**
 * 簡易 RSS パース（item の title, link, description, pubDate を取得）
 * より堅牢にする場合は fast-xml-parser 等を利用可
 */
function parseRssItems(xml: string): TruthSocialItem[] {
  const items: TruthSocialItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const link = extractTag(block, "link");
    const title = extractTag(block, "title");
    const desc = extractTag(block, "description");
    const pubDate = extractTag(block, "pubDate");
    const guid = extractTag(block, "guid");
    const id = guid || link || `${title}-${pubDate}`;
    items.push({
      id: id.trim(),
      title: (title || "").trim(),
      content: (desc || title || "").trim(),
      link: (link || "").trim(),
      pubDate: (pubDate || "").trim(),
    });
  }
  return items;
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  if (!m) return "";
  return decodeHtml(m[1].trim());
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
