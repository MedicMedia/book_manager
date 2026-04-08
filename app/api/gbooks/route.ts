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

const normalizeAuthor = (value?: string | string[]) => {
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return value;
};

export async function GET(request: Request) {
  try {
    const isbn = new URL(request.url).searchParams.get("isbn") ?? "";
    const normalizedIsbn = isbn.replace(/-/g, "");

    if (!/^\d{13}$/.test(normalizedIsbn)) {
      return Response.json({ ok: false, error: "ISBN は 13 桁で入力してください。" }, { status: 400 });
    }

    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${normalizedIsbn}&maxResults=1`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return Response.json({ ok: false, error: "Google Books API の呼び出しに失敗しました。" }, { status: 502 });
    }

    const payload = (await response.json()) as {
      items?: Array<{
        volumeInfo?: {
          title?: string;
          authors?: string[];
          publisher?: string;
          publishedDate?: string;
        };
      }>;
    };

    const volume = payload.items?.[0]?.volumeInfo;
    if (!volume) {
      return Response.json({ ok: false, error: "該当する書籍情報が見つかりませんでした。" }, { status: 404 });
    }

    const data: BookMeta = {
      isbn: normalizedIsbn,
      title: volume.title ?? "",
      author: normalizeAuthor(volume.authors),
      publisher: volume.publisher ?? "",
      publishedDate: normalizeDate(volume.publishedDate),
    };

    if (!data.title && !data.author && !data.publisher && !data.publishedDate) {
      return Response.json({ ok: false, error: "該当する書籍情報が見つかりませんでした。" }, { status: 404 });
    }

    return Response.json({ ok: true, data, source: "googleBooks" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "書籍情報の取得に失敗しました。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
