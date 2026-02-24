/**
 * ScreenshotOne API で URL のスクリーンショット画像を取得する
 * 環境変数: SCREENSHOT_API_KEY (Access Key), 任意で SCREENSHOT_API_URL, SCREENSHOT_API_SECRET (署名用)
 */

export interface ScreenshotOptions {
  url: string;
  /** ビューポート幅（ピクセル） */
  width?: number;
  /** 非表示にする CSS セレクター（ポップアップ等） */
  hideSelectors?: string[];
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
    viewport_width: String(options.width ?? 600),
  });
  if (options.hideSelectors?.length) {
    params.set("hide_selectors", options.hideSelectors.join(","));
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
