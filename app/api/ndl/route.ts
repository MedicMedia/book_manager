type BookMeta = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishedDate: string;
};

const normalizeDate = (value?: string) => {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/\./g, "-");
  const matched = normalized.match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?/);
  if (!matched) {
    return value;
  }

  const [, year, month, day] = matched;
  if (year && month && day) {
    return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`;
  }
  if (year && month) {
    return `${year}/${month.padStart(2, "0")}`;
  }
  return year;
};

const decodeXmlEntities = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const stripTags = (value: string) => value.replace(/<[^>]+>/g, "").trim();

const readTag = (xml: string, tagName: string) => {
  const escaped = tagName.replace(":", "\\:");
  const matched = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  if (!matched) {
    return "";
  }
  return stripTags(decodeXmlEntities(matched[1]));
};

export async function GET(request: Request) {
  try {
    const isbn = new URL(request.url).searchParams.get("isbn") ?? "";
    const normalizedIsbn = isbn.replace(/-/g, "");

    if (!/^\d{13}$/.test(normalizedIsbn)) {
      return Response.json({ ok: false, error: "ISBN は 13 桁で入力してください。" }, { status: 400 });
    }

    const response = await fetch(`https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${normalizedIsbn}&cnt=1`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json({ ok: false, error: "国会図書館APIの呼び出しに失敗しました。" }, { status: 502 });
    }

    const xml = await response.text();
    const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/i);
    if (!itemMatch) {
      return Response.json({ ok: false, error: "該当する書籍情報が見つかりませんでした。" }, { status: 404 });
    }

    const item = itemMatch[1];
    const data: BookMeta = {
      isbn: normalizedIsbn,
      title: readTag(item, "dc:title") || readTag(item, "title"),
      author: readTag(item, "dc:creator") || readTag(item, "author"),
      publisher: readTag(item, "dc:publisher"),
      publishedDate: normalizeDate(readTag(item, "dc:date") || readTag(item, "dcterms:issued")),
    };

    if (!data.title && !data.author && !data.publisher && !data.publishedDate) {
      return Response.json({ ok: false, error: "該当する書籍情報が見つかりませんでした。" }, { status: 404 });
    }

    return Response.json({ ok: true, data, source: "ndl" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "書籍情報の取得に失敗しました。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
