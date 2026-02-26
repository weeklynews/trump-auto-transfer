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

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * RSS フィードをパースして新着投稿リストを返す
 */
export async function fetchTruthSocialFeed(): Promise<TruthSocialItem[]> {
  const url = process.env.TRUTH_RSS_URL;
  if (!url) {
    console.error("[Truth Social] TRUTH_RSS_URL is not set");
    throw new Error("TRUTH_RSS_URL is not set");
  }
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[Truth Social] RSS fetch failed", {
      url,
      status: res.status,
      statusText: res.statusText,
      bodyPreview: body.slice(0, 200),
    });
    throw new Error(
      `Truth Social RSS error: ${res.status} ${res.statusText}${res.status === 403 ? " (blocked/forbidden)" : res.status === 404 ? " (URL not found)" : ""}`
    );
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
    const title = normalizeTruthContent(extractTag(block, "title"));
    const desc = normalizeTruthContent(extractTag(block, "description"));
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

function normalizeTruthContent(input: string): string {
  if (!input) return "";
  return input
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/?(div|section|article|li|ul|ol|blockquote|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
