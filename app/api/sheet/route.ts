import { getBookStore } from "@/lib/server/book-store";
import { isReversedDateRange, isValidBookDateInput } from "@/lib/date-format";
import type { BookFilters, NewBookInput } from "@/lib/types";

const MAX_INPUT_LENGTH = 1000;

const getFiltersFromUrl = (url: string): BookFilters => {
  const searchParams = new URL(url).searchParams;
  return {
    keyword: searchParams.get("keyword") ?? "",
    startDate: searchParams.get("startDate") ?? "",
    endDate: searchParams.get("endDate") ?? "",
    domain: searchParams.get("domain") ?? "",
    subject: searchParams.get("subject") ?? "",
  };
};

const hasTooLongValue = (values: Array<string | undefined>) => {
  return values.some((value) => (value?.length ?? 0) > MAX_INPUT_LENGTH);
};

const validateBookInput = (input: Partial<NewBookInput>) => {
  if (!input.isbn || input.isbn.replace(/-/g, "").length !== 13) {
    return "ISBN は 13 桁で入力してください。";
  }
  if (hasTooLongValue([input.title, input.author, input.publisher, input.publishedDate, input.domain, input.subject, input.note])) {
    return `入力は ${MAX_INPUT_LENGTH} 文字以内で入力してください。`;
  }
  if (!input.title?.trim()) {
    return "タイトルは必須です。";
  }
  if (!input.domain?.trim()) {
    return "領域は必須です。";
  }
  if (!input.subject?.trim()) {
    return "科目は必須です。";
  }
  if (input.publishedDate?.trim() && !isValidBookDateInput(input.publishedDate)) {
    return "発売日の形式が不正です。2020, 2020/11, 2020/1/1 の形式で入力してください。";
  }
  return null;
};

const validateFilters = (filters: BookFilters) => {
  if (hasTooLongValue([filters.keyword, filters.startDate, filters.endDate, filters.domain, filters.subject])) {
    return `入力は ${MAX_INPUT_LENGTH} 文字以内で入力してください。`;
  }
  if (filters.startDate?.trim() && !isValidBookDateInput(filters.startDate)) {
    return "開始日の形式が不正です。2020, 2020/11, 2020/1/1 の形式で入力してください。";
  }
  if (filters.endDate?.trim() && !isValidBookDateInput(filters.endDate)) {
    return "終了日の形式が不正です。2020, 2020/11, 2020/1/1 の形式で入力してください。";
  }
  if (filters.startDate?.trim() && filters.endDate?.trim() && isReversedDateRange(filters.startDate, filters.endDate)) {
    return "開始日と終了日の期間が逆転しています。";
  }
  return null;
};

export async function GET(request: Request) {
  try {
    const filters = getFiltersFromUrl(request.url);
    const filtersError = validateFilters(filters);
    if (filtersError) {
      return Response.json({ ok: false, error: filtersError }, { status: 400 });
    }
    const store = getBookStore();
    const rows = await store.list(filters);
    return Response.json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "一覧取得に失敗しました。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<NewBookInput> & { overwrite?: boolean };
    const input = body;
    const validationError = validateBookInput(input);
    if (validationError) {
      return Response.json({ ok: false, error: validationError }, { status: 400 });
    }

    const store = getBookStore();
    const normalizedInput: NewBookInput = {
      isbn: input.isbn!.replace(/-/g, "").trim(),
      title: input.title!.trim(),
      domain: input.domain!.trim(),
      subject: input.subject!.trim(),
      author: input.author?.trim() ?? "",
      publisher: input.publisher?.trim() ?? "",
      publishedDate: input.publishedDate?.trim() ?? "",
      note: input.note?.trim() ?? "",
    };

    const currentRows = await store.list();
    const duplicated = currentRows.find((row) => row.isbn === normalizedInput.isbn);

    if (duplicated && !body.overwrite) {
      return Response.json(
        {
          ok: false,
          error: "同じ ISBN の書籍が既に登録されています。上書きしますか？",
          errorCode: "DUPLICATE_ISBN",
        },
        { status: 409 }
      );
    }

    if (duplicated && body.overwrite) {
      const updated = await store.updateById(duplicated.id, normalizedInput);
      return Response.json({ ok: true, data: updated, overwritten: true });
    }

    const created = await store.create(normalizedInput);
    return Response.json({ ok: true, data: created, overwritten: false }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "登録に失敗しました。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get("id")?.trim() ?? "";

    if (!id) {
      return Response.json({ ok: false, error: "削除対象IDが指定されていません。" }, { status: 400 });
    }

    const store = getBookStore();
    await store.deleteById(id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "削除に失敗しました。";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
