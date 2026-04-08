"use client";

import { useMemo, useState } from "react";

import { DOMAIN_OPTIONS, SUBJECT_OPTIONS } from "@/lib/book-options";

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

export function SearchPanel({ onSearch, onReset, loading }: Props) {
  const [search, setSearch] = useState<SearchState>(DEFAULT_SEARCH);
  const availableDomains = useMemo(() => ["すべて", ...DOMAIN_OPTIONS], []);
  const availableSubjects = useMemo(() => ["すべて", ...SUBJECT_OPTIONS], []);

  return (
    <section className="panel panel-search">
      <div className="form-grid">
        <label className="form-label" htmlFor="keyword">
          キーワード
        </label>
        <input
          id="keyword"
          className="form-input"
          placeholder="タイトルや ISBN などを入力"
          value={search.keyword}
          onChange={(event) => setSearch((prev) => ({ ...prev, keyword: event.target.value }))}
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
            onChange={(event) => setSearch((prev) => ({ ...prev, startDate: event.target.value }))}
          />
          <span className="date-separator">〜</span>
          <input
            id="endDate"
            className="form-input"
            placeholder="終了日"
            value={search.endDate}
            onChange={(event) => setSearch((prev) => ({ ...prev, endDate: event.target.value }))}
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
          onChange={(event) => setSearch((prev) => ({ ...prev, domain: event.target.value }))}
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
        <button type="button" className="action-button action-button-primary" onClick={() => onSearch(search)} disabled={loading}>
          検索
        </button>
        <button
          type="button"
          className="action-button action-button-subtle"
          onClick={() => {
            setSearch(DEFAULT_SEARCH);
            onReset();
          }}
          disabled={loading}
        >
          リセット
        </button>
      </div>
    </section>
  );
}
