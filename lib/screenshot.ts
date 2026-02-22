/**
 * スクリーンショット API（Urlbox / ScreenshotOne 等）で URL の画像を取得する
 * 環境変数: SCREENSHOT_API_KEY, 必要に応じて SCREENSHOT_API_URL
 */

export interface ScreenshotOptions {
  url: string;
  /** 幅（ピクセル） */
  width?: number;
  /** セレクターで非表示にする要素（ポップアップ等） */
  hideSelectors?: string[];
}

/**
 * 指定URLのスクリーンショット画像を取得し、Buffer で返す
 * 実装例: Urlbox の場合は GET https://api.urlbox.io/v1/.../png?url=...&token=...
 */
export async function captureScreenshot(
  options: ScreenshotOptions
): Promise<Buffer> {
  const key = process.env.SCREENSHOT_API_KEY;
  if (!key) {
    throw new Error("SCREENSHOT_API_KEY is not set");
  }
  const baseUrl =
    process.env.SCREENSHOT_API_URL ?? "https://api.urlbox.io/v1/render";
  const params = new URLSearchParams({
    url: options.url,
    token: key,
    format: "png",
    width: String(options.width ?? 600),
  });
  if (options.hideSelectors?.length) {
    params.set("hide_selector", options.hideSelectors.join(","));
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
