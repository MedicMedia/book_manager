"use client";

import { useMemo, useState } from "react";

import { ALL_SUBJECT_OPTIONS, DOMAIN_OPTIONS, getSubjectsByDomain } from "@/lib/book-options";
import { isReversedDateRange, isValidBookDateInput } from "@/lib/date-format";

export type SearchState = {
  keyword: string;
  startDate: string;
  endDate: string;
  domain: string;
  subject: string;
};

type Props = {
  onSearch: (state: SearchState) => void;
  onReset: () => void;
  loading: boolean;
};

export const DEFAULT_SEARCH: SearchState = {
  keyword: "",
  startDate: "",
  endDate: "",
  domain: "すべて",
  subject: "すべて",
};

const MAX_INPUT_LENGTH = 1000;
const clampIsbnLikeKeyword = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 13);
};
const limitText = (value: string) => value.slice(0, MAX_INPUT_LENGTH);

export function SearchPanel({ onSearch, onReset, loading }: Props) {
  const [search, setSearch] = useState<SearchState>(DEFAULT_SEARCH);
  const [error, setError] = useState("");
  const [inputLimitError, setInputLimitError] = useState("");
  const availableDomains = useMemo(() => ["すべて", ...DOMAIN_OPTIONS], []);
  const availableSubjects = useMemo(() => {
    if (search.domain === "すべて") {
      return ["すべて", ...ALL_SUBJECT_OPTIONS];
    }
    return ["すべて", ...getSubjectsByDomain(search.domain)];
  }, [search.domain]);

  const handleSearchClick = () => {
    if (inputLimitError) {
      return;
    }

    const startDate = search.startDate.trim();
    const endDate = search.endDate.trim();

    if (startDate && !isValidBookDateInput(startDate)) {
      setError("開始日の形式が不正です。2020, 2020/11, 2020/1/1 の形式で入力してください。");
      return;
    }

    if (endDate && !isValidBookDateInput(endDate)) {
      setError("終了日の形式が不正です。2020, 2020/11, 2020/1/1 の形式で入力してください。");
      return;
    }
    if (startDate && endDate && isReversedDateRange(startDate, endDate)) {
      setError("開始日と終了日の期間が逆転しています。");
      return;
    }

    setError("");
    onSearch(search);
  };

  const setLimitedSearchField = (key: "startDate" | "endDate", value: string) => {
    if (value.length > MAX_INPUT_LENGTH) {
      setInputLimitError("1000字以内で入力してください。");
    } else {
      setInputLimitError("");
    }

    setSearch((prev) => ({ ...prev, [key]: limitText(value) }));
  };

  return (
    <section className="panel panel-search">
      <div className="form-grid">
        <label className="form-label" htmlFor="keyword">
          キーワード
        </label>
        <input
          id="keyword"
          className="form-input"
          placeholder="ISBNを入力（半角数字）"
          value={search.keyword}
          onChange={(event) => setSearch((prev) => ({ ...prev, keyword: clampIsbnLikeKeyword(event.target.value) }))}
          inputMode="numeric"
          maxLength={13}
        />

        <label className="form-label" htmlFor="startDate">
          発売日
        </label>
        <div className="date-row">
          <input
            id="startDate"
            className="form-input"
            placeholder="開始日"
            value={search.startDate}
            onChange={(event) => {
              setLimitedSearchField("startDate", event.target.value);
              setError("");
            }}
          />
          <span className="date-separator">〜</span>
          <input
            id="endDate"
            className="form-input"
            placeholder="終了日"
            value={search.endDate}
            onChange={(event) => {
              setLimitedSearchField("endDate", event.target.value);
              setError("");
            }}
          />
        </div>
        <p className="form-hint">2020, 2020/11, 2020/1/1 のような形式に対応しています。</p>

        <label className="form-label" htmlFor="domain">
          領域
        </label>
        <select
          id="domain"
          className="form-input"
          value={search.domain}
          onChange={(event) =>
            setSearch((prev) => ({
              ...prev,
              domain: event.target.value,
              subject: "すべて",
            }))
          }
        >
          {availableDomains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>

        <label className="form-label" htmlFor="subject">
          科目
        </label>
        <select
          id="subject"
          className="form-input"
          value={search.subject}
          onChange={(event) => setSearch((prev) => ({ ...prev, subject: event.target.value }))}
        >
          {availableSubjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      <div className="button-row">
        <button type="button" className="action-button action-button-primary" onClick={handleSearchClick} disabled={loading}>
          検索
        </button>
        <button
          type="button"
          className="action-button action-button-subtle"
          onClick={() => {
            setSearch(DEFAULT_SEARCH);
            setError("");
            setInputLimitError("");
            onReset();
          }}
          disabled={loading}
        >
          リセット
        </button>
      </div>
      {inputLimitError ? <p className="status-message status-error">{inputLimitError}</p> : null}
      {error ? <p className="status-message status-error">{error}</p> : null}
    </section>
  );
}
