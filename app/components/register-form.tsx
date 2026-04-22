"use client";

import { useMemo, useState } from "react";

import { DOMAIN_OPTIONS, getSubjectsByDomain } from "@/lib/book-options";

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

const normalizeIsbn = (value: string) => value.replace(/-/g, "").trim();

export function RegisterForm({ onRegistered }: Props) {
  const [form, setForm] = useState<RegisterState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isbnDigits = useMemo(() => normalizeIsbn(form.isbn), [form.isbn]);
  const subjectOptions = useMemo(() => getSubjectsByDomain(form.domain), [form.domain]);

  const updateField = <K extends keyof RegisterState>(key: K, value: RegisterState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fetchBookMetadata = async (endpoint: string) => {
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

    return { response, payload };
  };

  const autoFillByIsbn = async () => {
    const isbn = normalizeIsbn(form.isbn);
    if (isbn.length !== 13) {
      return;
    }

    setAutoLoading(true);
    setError("");

    try {
      const ndl = await fetchBookMetadata(`/api/ndl?isbn=${encodeURIComponent(isbn)}`);
      const hasNdl = ndl.response.ok && ndl.payload.ok && ndl.payload.data;

      const isMissingAnyField =
        !ndl.payload.data?.title || !ndl.payload.data?.author || !ndl.payload.data?.publisher || !ndl.payload.data?.publishedDate;
      const shouldTryGoogle = !hasNdl || isMissingAnyField;
      const google = shouldTryGoogle
        ? await fetchBookMetadata(`/api/gbooks?isbn=${encodeURIComponent(isbn)}`)
        : null;
      const hasGoogle = Boolean(google?.response.ok && google?.payload.ok && google?.payload.data);

      if (!hasNdl && !hasGoogle) {
        throw new Error(ndl.payload.error ?? google?.payload.error ?? "ISBN から書誌情報を取得できませんでした。");
      }

      const primary = ndl.payload.data;
      const secondary = google?.payload.data;

      setForm((prev) => ({
        ...prev,
        title: primary?.title || secondary?.title || "",
        author: primary?.author || secondary?.author || "",
        publisher: primary?.publisher || secondary?.publisher || "",
        publishedDate: primary?.publishedDate || secondary?.publishedDate || "",
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ISBN から書誌情報を取得できませんでした。");
    } finally {
      setAutoLoading(false);
    }
  };

  const submit = async () => {
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
        throw new Error(payload.error ?? "登録に失敗しました。");
      }

      setMessage(payload.overwritten ? "書籍を上書き登録しました。" : "書籍を登録しました。");
      setForm(DEFAULT_FORM);
      onRegistered?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登録に失敗しました。");
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
            placeholder="13桁の数字を入力（ハイフンありでも OK）"
            value={form.isbn}
            onChange={(event) => updateField("isbn", event.target.value)}
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
          onChange={(event) => updateField("title", event.target.value)}
        />

        <label className="form-label" htmlFor="author">
          著者
        </label>
        <input
          id="author"
          className="form-input"
          value={form.author}
          onChange={(event) => updateField("author", event.target.value)}
        />

        <label className="form-label" htmlFor="publisher">
          出版社
        </label>
        <input
          id="publisher"
          className="form-input"
          value={form.publisher}
          onChange={(event) => updateField("publisher", event.target.value)}
        />

        <label className="form-label" htmlFor="publishedDate">
          発売日
        </label>
        <input
          id="publishedDate"
          className="form-input"
          placeholder="2020, 2020/11, 2020/1/1 など"
          value={form.publishedDate}
          onChange={(event) => updateField("publishedDate", event.target.value)}
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
          <option value="">選択してください</option>
          {subjectOptions.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>

        <label className="form-label" htmlFor="note">
          備考
        </label>
        <textarea
          id="note"
          className="form-input form-textarea"
          value={form.note}
          onChange={(event) => updateField("note", event.target.value)}
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
          }}
          disabled={loading || autoLoading}
        >
          リセット
        </button>
      </div>

      {autoLoading && <p className="status-message">ISBN から書誌情報を取得しています...</p>}
      {message && <p className="status-message status-success">{message}</p>}
      {error && <p className="status-message status-error">{error}</p>}
      <p className="status-message required-note">* は必須項目です。</p>
    </section>
  );
}
