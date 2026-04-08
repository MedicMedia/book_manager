import { getBookStore } from "@/lib/server/book-store";
import type { BookFilters, NewBookInput } from "@/lib/types";

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

const validateBookInput = (input: Partial<NewBookInput>) => {
  if (!input.isbn || input.isbn.replace(/-/g, "").length !== 13) {
    return "ISBN は 13 桁で入力してください。";
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
  return null;
};

export async function GET(request: Request) {
  try {
    const filters = getFiltersFromUrl(request.url);
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
