import type { BookFilters, BookRecord, NewBookInput } from "@/lib/types";

type StoreResponse<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

type BookStore = {
  list(filters?: BookFilters): Promise<BookRecord[]>;
  create(input: NewBookInput): Promise<BookRecord>;
  updateById(id: string, input: NewBookInput): Promise<BookRecord>;
  deleteById(id: string): Promise<void>;
};

const SHEET_HEADER_KEYS = {
  id: "ID",
  createdAt: "登録日",
  isbn: "ISBN",
  domain: "領域",
  subject: "科目",
  title: "書籍名",
  author: "著者名",
  publisher: "出版社名",
  publishedDate: "発売日",
  note: "備考",
} as const;

const memoryState: {
  rows: BookRecord[];
  nextId: number;
} = {
  rows: [],
  nextId: 1,
};

const toNowString = () => {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  })
    .format(new Date())
    .replace(" ", " ");
};

const normalizeIsbn = (value: string) => value.replace(/-/g, "").trim();

const normalizeBook = (raw: unknown): BookRecord => {
  const row = (raw ?? {}) as Record<string, unknown>;

  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "string") {
        return value;
      }
      if (typeof value === "number") {
        return String(value);
      }
    }
    return "";
  };

  return {
    id: pick(SHEET_HEADER_KEYS.id, "id"),
    createdAt: pick(SHEET_HEADER_KEYS.createdAt, "createdAt"),
    isbn: normalizeIsbn(pick(SHEET_HEADER_KEYS.isbn, "isbn")),
    domain: pick(SHEET_HEADER_KEYS.domain, "domain"),
    subject: pick(SHEET_HEADER_KEYS.subject, "subject"),
    title: pick(SHEET_HEADER_KEYS.title, "title"),
    author: pick(SHEET_HEADER_KEYS.author, "author"),
    publisher: pick(SHEET_HEADER_KEYS.publisher, "publisher"),
    publishedDate: pick(SHEET_HEADER_KEYS.publishedDate, "publishedDate"),
    note: pick(SHEET_HEADER_KEYS.note, "note"),
  };
};

const parseLooseDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[.-]/g, "/");
  const [year, month = "1", day = "1"] = normalized.split("/");

  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return null;
  }

  const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getTime();
};

const includesKeyword = (row: BookRecord, keyword: string) => {
  const haystack = [row.isbn, row.title, row.author, row.publisher, row.note, row.domain, row.subject]
    .join(" ")
    .toLowerCase();
  return haystack.includes(keyword.toLowerCase());
};

const filterBooks = (rows: BookRecord[], filters?: BookFilters) => {
  const startAt = parseLooseDate(filters?.startDate);
  const endAt = parseLooseDate(filters?.endDate);

  return rows.filter((row) => {
    if (!filters) {
      return true;
    }

    if (filters.keyword && !includesKeyword(row, filters.keyword)) {
      return false;
    }

    if (filters.domain && filters.domain !== "すべて" && row.domain !== filters.domain) {
      return false;
    }

    if (filters.subject && filters.subject !== "すべて" && row.subject !== filters.subject) {
      return false;
    }

    if (startAt || endAt) {
      const publishedAt = parseLooseDate(row.publishedDate);
      if (publishedAt === null) {
        return false;
      }
      if (startAt && publishedAt < startAt) {
        return false;
      }
      if (endAt && publishedAt > endAt) {
        return false;
      }
    }

    return true;
  });
};

class MemoryBookStore implements BookStore {
  async list(filters?: BookFilters) {
    const sorted = [...memoryState.rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return filterBooks(sorted, filters);
  }

  async create(input: NewBookInput) {
    const now = toNowString();
    const row: BookRecord = {
      id: String(memoryState.nextId++),
      createdAt: now,
      isbn: normalizeIsbn(input.isbn),
      domain: input.domain,
      subject: input.subject,
      title: input.title,
      author: input.author?.trim() ?? "",
      publisher: input.publisher?.trim() ?? "",
      publishedDate: input.publishedDate?.trim() ?? "",
      note: input.note?.trim() ?? "",
    };

    memoryState.rows.unshift(row);
    return row;
  }

  async updateById(id: string, input: NewBookInput) {
    const target = memoryState.rows.find((row) => row.id === id);
    if (!target) {
      throw new Error("更新対象の書籍が見つかりませんでした。");
    }

    target.createdAt = toNowString();
    target.isbn = normalizeIsbn(input.isbn);
    target.domain = input.domain;
    target.subject = input.subject;
    target.title = input.title;
    target.author = input.author?.trim() ?? "";
    target.publisher = input.publisher?.trim() ?? "";
    target.publishedDate = input.publishedDate?.trim() ?? "";
    target.note = input.note?.trim() ?? "";

    return target;
  }

  async deleteById(id: string) {
    const index = memoryState.rows.findIndex((row) => row.id === id);
    if (index < 0) {
      throw new Error("削除対象の書籍が見つかりませんでした。");
    }
    memoryState.rows.splice(index, 1);
  }
}

class AppsScriptBookStore implements BookStore {
  private endpoint: string;
  private token: string;

  constructor(endpoint: string, token: string) {
    this.endpoint = endpoint;
    this.token = token;
  }

  private async request<T>(action: "list" | "create" | "update" | "delete", payload?: Record<string, unknown>) {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: this.token,
        action,
        ...payload,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Apps Script request failed: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const rawBody = await response.text();

    if (!contentType.includes("application/json")) {
      throw new Error(
        "Apps Script が JSON ではなく HTML を返しました。公開設定(アクセスできるユーザー) とデプロイ URL を確認してください。"
      );
    }

    let json: StoreResponse<T>;
    try {
      json = JSON.parse(rawBody) as StoreResponse<T>;
    } catch {
      throw new Error(
        "Apps Script のレスポンス JSON を解析できませんでした。Web アプリ URL と doPost の実装を確認してください。"
      );
    }

    if (!json.ok) {
      throw new Error(json.error ?? "Apps Script returned an error");
    }

    return json.data;
  }

  async list(filters?: BookFilters) {
    const rows = await this.request<unknown[]>("list", { filters: filters ?? {} });
    const normalized = rows.map(normalizeBook);
    const sorted = normalized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return filterBooks(sorted, filters);
  }

  async create(input: NewBookInput) {
    const created = await this.request<unknown>("create", { book: input });
    return normalizeBook(created);
  }

  async updateById(id: string, input: NewBookInput) {
    const updated = await this.request<unknown>("update", { id, book: input });
    return normalizeBook(updated);
  }

  async deleteById(id: string) {
    await this.request<unknown>("delete", { id });
  }
}

let cachedStore: BookStore | null = null;

export const getBookStore = (): BookStore => {
  if (cachedStore) {
    return cachedStore;
  }

  const endpoint = process.env.GOOGLE_APPS_SCRIPT_ENDPOINT?.trim() ?? "";
  const token = process.env.GOOGLE_APPS_SCRIPT_TOKEN?.trim() ?? "";

  if (endpoint && token) {
    cachedStore = new AppsScriptBookStore(endpoint, token);
    return cachedStore;
  }

  cachedStore = new MemoryBookStore();
  return cachedStore;
};
