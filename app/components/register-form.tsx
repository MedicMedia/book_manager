"use client";

import { useMemo, useState } from "react";

import { DOMAIN_OPTIONS, getSubjectsByDomain } from "@/lib/book-options";
import { formatApiCaughtError, formatApiHttpError } from "@/lib/client/api-diagnostics";
import { isValidBookDateInput } from "@/lib/date-format";

type Props = {
  onRegistered?: () => void;
};

type RegisterState = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishedDate: string;
  domain: string;
  subject: string;
  note: string;
};

const DEFAULT_FORM: RegisterState = {
  isbn: "",
  title: "",
  author: "",
  publisher: "",
  publishedDate: "",
  domain: "",
  subject: "",
  note: "",
};

const MAX_INPUT_LENGTH = 1000;
const normalizeIsbn = (value: string) => value.replace(/\D/g, "").trim();
const clampIsbnInput = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 13);
};
const limitText = (value: string) => value.slice(0, MAX_INPUT_LENGTH);

export function RegisterForm({ onRegistered }: Props) {
  const [form, setForm] = useState<RegisterState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inputLimitError, setInputLimitError] = useState("");

  const isbnDigits = useMemo(() => normalizeIsbn(form.isbn), [form.isbn]);
  const subjectOptions = useMemo(() => getSubjectsByDomain(form.domain), [form.domain]);

  const updateField = <K extends keyof RegisterState>(key: K, value: RegisterState[K]) => {
    setMessage("");
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const updateLimitedField = <K extends keyof RegisterState>(key: K, value: RegisterState[K]) => {
    const nextValue = String(value);
    if (nextValue.length > MAX_INPUT_LENGTH) {
      setInputLimitError("1000字以内で入力してください。");
    } else {
      setInputLimitError("");
    }
    updateField(key, limitText(nextValue) as RegisterState[K]);
  };

  const fetchBookMetadata = async (endpoint: string, apiKey: "ndl" | "gbooks") => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: {
          title?: string;
          author?: string;
          publisher?: string;
          publishedDate?: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        return {
          ok: false as const,
          data: null,
          error: formatApiHttpError(apiKey, response.status, payload.error),
        };
      }

      return {
        ok: true as const,
        data: payload.data ?? null,
        error: "",
      };
    } catch (caught) {
      return {
        ok: false as const,
        data: null,
        error: formatApiCaughtError(apiKey, caught),
      };
    }
  };

  const autoFillByIsbn = async () => {
    const isbn = normalizeIsbn(form.isbn);
    if (isbn.length !== 13) {
      return;
    }

    setAutoLoading(true);
    setMessage("");
    setError("");

    try {
      const ndl = await fetchBookMetadata(`/api/ndl?isbn=${encodeURIComponent(isbn)}`, "ndl");
      const hasNdl = ndl.ok && ndl.data;

      const isMissingAnyField = !ndl.data?.title || !ndl.data?.author || !ndl.data?.publisher || !ndl.data?.publishedDate;
      const shouldTryGoogle = !hasNdl || isMissingAnyField;
      const google = shouldTryGoogle
        ? await fetchBookMetadata(`/api/gbooks?isbn=${encodeURIComponent(isbn)}`, "gbooks")
        : null;
      const hasGoogle = Boolean(google?.ok && google?.data);

      if (!hasNdl && !hasGoogle) {
        const reasons = [ndl.error, google?.error].filter((item): item is string => Boolean(item && item.trim().length > 0));
        throw new Error(reasons.length > 0 ? reasons.join(" / ") : "ISBN から書誌情報を取得できませんでした。");
      }

      const primary = ndl.data;
      const secondary = google?.data;

      setForm((prev) => ({
        ...prev,
        title: primary?.title || secondary?.title || "",
        author: primary?.author || secondary?.author || "",
        publisher: primary?.publisher || secondary?.publisher || "",
        publishedDate: primary?.publishedDate || secondary?.publishedDate || "",
      }));
    } catch (caught) {
      setError(formatApiCaughtError("ndl", caught));
    } finally {
      setAutoLoading(false);
    }
  };

  const submit = async () => {
    const publishedDate = form.publishedDate.trim();
    if (publishedDate && !isValidBookDateInput(publishedDate)) {
      setError("発売日の形式が不正です。2020, 2020/11, 2020/1/1 の形式で入力してください。");
      setMessage("");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      let response = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isbn: normalizeIsbn(form.isbn),
          title: form.title,
          author: form.author,
          publisher: form.publisher,
          publishedDate: form.publishedDate,
          domain: form.domain,
          subject: form.subject,
          note: form.note,
          overwrite: false,
        }),
      });

      let payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        errorCode?: string;
        overwritten?: boolean;
      };

      if (!response.ok && payload.errorCode === "DUPLICATE_ISBN") {
        const shouldOverwrite = window.confirm("同じ ISBN が既に登録されています。上書きしますか？");
        if (!shouldOverwrite) {
          setMessage("登録をキャンセルしました。");
          return;
        }

        response = await fetch("/api/sheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isbn: normalizeIsbn(form.isbn),
            title: form.title,
            author: form.author,
            publisher: form.publisher,
            publishedDate: form.publishedDate,
            domain: form.domain,
            subject: form.subject,
            note: form.note,
            overwrite: true,
          }),
        });
        payload = (await response.json()) as {
          ok: boolean;
          error?: string;
          errorCode?: string;
          overwritten?: boolean;
        };
      }

      if (!response.ok || !payload.ok) {
        throw new Error(formatApiHttpError("sheet-register", response.status, payload.error));
      }

      setMessage(payload.overwritten ? "書籍を上書き登録しました。" : "書籍を登録しました。");
      setForm(DEFAULT_FORM);
      setInputLimitError("");
      onRegistered?.();
    } catch (caught) {
      setError(formatApiCaughtError("sheet-register", caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel panel-register">
      <div className="form-grid">
        <label className="form-label" htmlFor="isbn">
          ISBN <span className="required">*</span>
        </label>
        <div className="isbn-row">
          <input
            id="isbn"
            className="form-input"
            placeholder="13桁の数字を入力（半角数字）"
            value={form.isbn}
            onChange={(event) => updateField("isbn", clampIsbnInput(event.target.value))}
            inputMode="numeric"
            maxLength={13}
          />
          <button
            type="button"
            className="action-button action-button-primary auto-fill-button"
            onClick={() => void autoFillByIsbn()}
            disabled={autoLoading || isbnDigits.length !== 13}
          >
            {autoLoading ? "検索中..." : "自動入力"}
          </button>
          <span className="isbn-count">{isbnDigits.length}/13</span>
        </div>
        <p className="form-hint">ISBN を入力すると、タイトルなどを自動入力します。</p>

        <label className="form-label" htmlFor="title">
          タイトル <span className="required">*</span>
        </label>
        <input
          id="title"
          className="form-input"
          value={form.title}
          onChange={(event) => updateLimitedField("title", event.target.value)}
        />

        <label className="form-label" htmlFor="author">
          著者
        </label>
        <input
          id="author"
          className="form-input"
          value={form.author}
          onChange={(event) => updateLimitedField("author", event.target.value)}
        />

        <label className="form-label" htmlFor="publisher">
          出版社
        </label>
        <input
          id="publisher"
          className="form-input"
          value={form.publisher}
          onChange={(event) => updateLimitedField("publisher", event.target.value)}
        />

        <label className="form-label" htmlFor="publishedDate">
          発売日
        </label>
        <input
          id="publishedDate"
          className="form-input"
          placeholder="2020, 2020/11, 2020/1/1 など"
          value={form.publishedDate}
          onChange={(event) => updateLimitedField("publishedDate", event.target.value)}
        />

        <label className="form-label" htmlFor="domain-select">
          領域 <span className="required">*</span>
        </label>
        <select
          id="domain-select"
          className="form-input"
          value={form.domain}
          onChange={(event) => {
            const nextDomain = event.target.value;
            setForm((prev) => ({
              ...prev,
              domain: nextDomain,
              subject: "",
            }));
          }}
        >
          <option value="">選択してください</option>
          {DOMAIN_OPTIONS.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>

        <label className="form-label" htmlFor="subject-select">
          科目 <span className="required">*</span>
        </label>
        <select
          id="subject-select"
          className="form-input"
          value={form.subject}
          onChange={(event) => updateField("subject", event.target.value)}
        >
          {!form.domain ? (
            <option value="">先に領域を選択してください</option>
          ) : (
            <>
              <option value="">選択してください</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </>
          )}
        </select>

        <label className="form-label" htmlFor="note">
          備考
        </label>
        <textarea
          id="note"
          className="form-input form-textarea"
          value={form.note}
          onChange={(event) => updateLimitedField("note", event.target.value)}
        />
      </div>

      <div className="button-row">
        <button type="button" className="action-button action-button-primary" onClick={() => void submit()} disabled={loading}>
          {loading ? "登録中..." : "登録"}
        </button>
        <button
          type="button"
          className="action-button action-button-subtle"
          onClick={() => {
            setForm(DEFAULT_FORM);
            setMessage("");
            setError("");
            setInputLimitError("");
          }}
          disabled={loading || autoLoading}
        >
          リセット
        </button>
      </div>

      {autoLoading && <p className="status-message">ISBN から書誌情報を取得しています...</p>}
      {message && <p className="status-message status-success">{message}</p>}
      {inputLimitError && <p className="status-message status-error">{inputLimitError}</p>}
      {error && <p className="status-message status-error">{error}</p>}
      <p className="status-message required-note">* は必須項目です。</p>
    </section>
  );
}
