/**
 * ScreenshotOne API で URL のスクリーンショット画像を取得する
 * 環境変数: SCREENSHOT_API_KEY (Access Key), 任意で SCREENSHOT_API_URL, SCREENSHOT_API_SECRET (署名用)
 */

export interface ScreenshotOptions {
  url: string;
  /** ビューポート幅（ピクセル） */
  width?: number;
  /** ビューポート高さ（ピクセル） */
  height?: number;
  /** ページ全体を撮影する */
  fullPage?: boolean;
  /** 描画安定化のための待機時間（ミリ秒） */
  delayMs?: number;
  /** 撮影前の待機条件 */
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  /** 撮影対象の CSS セレクター */
  selector?: string;
  /** 追加で注入する CSS */
  css?: string;
  /** 非表示にする CSS セレクター（ポップアップ等） */
  hideSelectors?: string[];
  /** 削除する CSS セレクター */
  removeSelectors?: string[];
}

/**
 * 指定URLのスクリーンショット画像を取得し、Buffer で返す
 * ScreenshotOne: https://api.screenshotone.com/take?access_key=...&url=...&format=png&viewport_width=...
 */
export async function captureScreenshot(
  options: ScreenshotOptions
): Promise<Buffer> {
  const accessKey = process.env.SCREENSHOT_API_KEY;
  if (!accessKey) {
    throw new Error("SCREENSHOT_API_KEY is not set");
  }
  const baseUrl =
    process.env.SCREENSHOT_API_URL ?? "https://api.screenshotone.com/take";
  const params = new URLSearchParams({
    access_key: accessKey,
    url: options.url,
    format: "png",
    viewport_width: String(options.width ?? 900),
    full_page: String(options.fullPage ?? true),
  });
  if (typeof options.height === "number") {
    params.set("viewport_height", String(options.height));
  }
  if (typeof options.delayMs === "number") {
    params.set("delay", String(options.delayMs));
  }
  if (options.waitUntil) {
    params.set("wait_until", options.waitUntil);
  }
  if (options.selector?.trim()) {
    params.set("selector", options.selector.trim());
  }
  if (options.css?.trim()) {
    params.set("css", options.css);
  }
  if (options.hideSelectors?.length) {
    params.set("hide_selectors", options.hideSelectors.join(","));
  }
  if (options.removeSelectors?.length) {
    params.set("remove_selectors", options.removeSelectors.join(","));
  }
  const res = await fetch(`${baseUrl}?${params.toString()}`, {
    method: "GET",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Screenshot API error: ${res.status} ${text}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
