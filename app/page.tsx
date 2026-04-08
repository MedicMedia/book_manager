"use client";

import { useState } from "react";

import type { BookRecord } from "@/lib/types";

import { RegisterForm } from "./components/register-form";
import { ResultsTable } from "./components/results-table";
import { SearchPanel, type SearchState } from "./components/search-panel";

type Tab = "search" | "register";

const buildQueryString = (search: SearchState) => {
  const params = new URLSearchParams();
  if (search.keyword.trim()) {
    params.set("keyword", search.keyword.trim());
  }
  if (search.startDate.trim()) {
    params.set("startDate", search.startDate.trim());
  }
  if (search.endDate.trim()) {
    params.set("endDate", search.endDate.trim());
  }
  if (search.domain !== "すべて") {
    params.set("domain", search.domain);
  }
  if (search.subject !== "すべて") {
    params.set("subject", search.subject);
  }
  return params.toString();
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [rows, setRows] = useState<BookRecord[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearch, setLastSearch] = useState<SearchState | null>(null);

  const fetchBooksBySearch = async (search: SearchState) => {
    const startAt = Date.now();
    setSearchLoading(true);
    setSearchError("");

    try {
      const query = buildQueryString(search);
      const endpoint = query.length > 0 ? `/api/sheet?${query}` : "/api/sheet";
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = (await response.json()) as {
        ok: boolean;
        data?: BookRecord[];
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "検索に失敗しました。");
      }

      setRows(payload.data ?? []);
    } catch (caught) {
      setRows([]);
      setSearchError(caught instanceof Error ? caught.message : "検索に失敗しました。");
    } finally {
      const elapsed = Date.now() - startAt;
      const minLoadingMs = 350;
      if (elapsed < minLoadingMs) {
        await new Promise((resolve) => setTimeout(resolve, minLoadingMs - elapsed));
      }
      setSearchLoading(false);
    }
  };

  const handleSearch = async (search: SearchState) => {
    setHasSearched(true);
    setLastSearch(search);
    await fetchBooksBySearch(search);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("この書籍を削除しますか？")) {
      return;
    }

    setDeletingId(id);
    setSearchError("");

    try {
      const response = await fetch(`/api/sheet?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "削除に失敗しました。");
      }

      if (lastSearch) {
        await fetchBooksBySearch(lastSearch);
      } else {
        setRows((prev) => prev.filter((row) => row.id !== id));
      }
    } catch (caught) {
      setSearchError(caught instanceof Error ? caught.message : "削除に失敗しました。");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <main className="book-app">
      <section className="book-card">
        <div className="tab-header" role="tablist" aria-label="書籍管理タブ">
          <button
            type="button"
            className={`tab-button ${activeTab === "search" ? "tab-active-search" : ""}`}
            role="tab"
            aria-selected={activeTab === "search"}
            onClick={() => setActiveTab("search")}
          >
            検索
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === "register" ? "tab-active-register" : ""}`}
            role="tab"
            aria-selected={activeTab === "register"}
            onClick={() => setActiveTab("register")}
          >
            登録
          </button>
        </div>

        <div className="tab-body">
          {activeTab === "search" ? (
            <SearchPanel
              loading={searchLoading}
              onSearch={(state) => void handleSearch(state)}
              onReset={() => {
                setRows([]);
                setSearchError("");
                setHasSearched(false);
                setLastSearch(null);
              }}
            />
          ) : (
            <RegisterForm />
          )}
        </div>
      </section>

      {process.env.NEXT_PUBLIC_SPREADSHEET_URL ? (
        <p className="sheet-link-wrap">
          <a href={process.env.NEXT_PUBLIC_SPREADSHEET_URL} target="_blank" rel="noreferrer" className="sheet-link">
            （社員のみ）書籍リストをスプレッドシートで見る
          </a>
        </p>
      ) : null}

      {activeTab === "search" && hasSearched ? (
        <section className="search-result-section">
          <div className="search-result-divider" />
          {searchLoading ? (
            <div className="search-loading-wrap" aria-live="polite" aria-busy="true">
              <span className="search-loading-spinner" />
              <p className="status-message">検索中です...</p>
            </div>
          ) : (
            <>
              <p className="search-result-count">検索結果: {rows.length} 件</p>
              {searchError ? (
                <p className="status-message status-error">{searchError}</p>
              ) : (
                <ResultsTable rows={rows} deletingId={deletingId} onDelete={(id) => void handleDelete(id)} />
              )}
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
