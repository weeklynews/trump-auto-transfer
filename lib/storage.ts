import { put, del } from "@vercel/blob";

/**
 * 画像データを Vercel Blob に保存し、永続URLを返す
 */
export async function uploadScreenshot(
  buffer: Buffer,
  pathname: string
): Promise<string> {
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: "image/png",
  });
  return blob.url;
}

/**
 * Blob を削除（必要に応じて使用）
 */
export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}
