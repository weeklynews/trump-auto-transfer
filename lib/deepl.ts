/**
 * DeepL API で英語 → 日本語翻訳
 * 環境変数: DEEPL_API_KEY
 */

const DEEPL_API = "https://api-free.deepl.com/v2/translate";

export async function translateToJapanese(text: string): Promise<string> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) {
    throw new Error("DEEPL_API_KEY is not set");
  }
  const params = new URLSearchParams({
    auth_key: key,
    text,
    source_lang: "EN",
    target_lang: "JA",
  });
  const res = await fetch(DEEPL_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepL API error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as {
    translations?: { text?: string }[];
  };
  const translated = data.translations?.[0]?.text;
  if (!translated) {
    throw new Error("DeepL returned no translation");
  }
  return translated;
}
