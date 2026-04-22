# 書籍登録・検索 Web アプリ

Next.js (App Router) で作成した、書籍の `登録` と `検索` を行うアプリです。  
登録データは Google スプレッドシートへ保存でき、ISBN から書誌情報を自動入力できます。

## 機能

- 検索タブ
- キーワード検索（ISBN / タイトル / 著者 / 出版社 / 備考 / 領域 / 科目）
- 発売日の期間検索（`2020`, `2020/11`, `2020/1/1` 形式）
- 領域・科目フィルター
- 登録タブ
- 必須項目バリデーション（ISBN, タイトル, 領域, 科目）
- ISBN 13 桁入力時に 国会図書館API + Google Books API からタイトル等を自動入力
- 検索結果一覧から書籍の削除（スプレッドシート行を物理削除）
- ISBN 重複時は確認ダイアログを表示し、上書き登録が可能
- Google スプレッドシート連携（Apps Script Web API 経由）

## API 設計（本アプリで採用）

- 書籍登録 API（保存先）
- `Google Apps Script Web API` を採用
- 理由: スプレッドシートをそのままデータストアにでき、運用がシンプル
- ISBN 書誌 API（自動入力）
- `国会図書館API` + `Google Books API` を併用
- 理由: 国会図書館APIを優先し、ヒットしない/不足する場合を Google Books で補完する

## ローカル起動

```bash
npm install
npm run dev
```

`http://localhost:3000` を開いてください。

## 環境変数

`.env.local` を作成し、以下を設定します。

```bash
GOOGLE_APPS_SCRIPT_ENDPOINT=
GOOGLE_APPS_SCRIPT_TOKEN=
NEXT_PUBLIC_SPREADSHEET_URL=
```

- `GOOGLE_APPS_SCRIPT_ENDPOINT`: Apps Script を Web アプリ公開した URL
- `GOOGLE_APPS_SCRIPT_TOKEN`: 認証用トークン
- `NEXT_PUBLIC_SPREADSHEET_URL`: 画面下に表示するスプレッドシート URL

> `GOOGLE_APPS_SCRIPT_ENDPOINT` と `GOOGLE_APPS_SCRIPT_TOKEN` が未設定の場合は、メモリ保存モードで動作します（開発用）。

## Google スプレッドシート連携手順

1. 用意済みのスプレッドシートを開く
2. `拡張機能 > Apps Script` を開く
3. `docs/google-apps-script.gs` のコードを `Code.gs` に貼り付ける
4. Apps Script の `プロジェクトの設定 > スクリプト プロパティ` で `API_TOKEN` を作成
5. 値に任意の長いランダム文字列を設定
6. `デプロイ > 新しいデプロイ > 種類: ウェブアプリ`
7. 実行ユーザー: 自分、アクセス権: 全員 を選択してデプロイ
8. 発行された URL を `GOOGLE_APPS_SCRIPT_ENDPOINT` に設定
9. 手順4のトークン値を `GOOGLE_APPS_SCRIPT_TOKEN` に設定
10. `NEXT_PUBLIC_SPREADSHEET_URL` へシート URL を設定

> 削除機能を使う場合: `docs/google-apps-script.gs` を最新に更新後、Apps Script を再デプロイしてください。
> 同時登録時のID衝突を避けるため、IDは Apps Script 側で `Utilities.getUuid()` により生成します。
> さらに、`create / update / delete` は Apps Script 側で `LockService` により排他制御しています。

## フロントエンド構成

- `app/page.tsx`
- タブ切り替えと全体状態
- `app/components/search-panel.tsx`
- 検索フォームと結果取得
- `app/components/register-form.tsx`
- 登録フォームと ISBN 自動入力
- `app/components/results-table.tsx`
- 検索結果テーブル

## サーバー構成

- `app/api/sheet/route.ts`
- `GET`: 検索、`POST`: 登録
- `app/api/ndl/route.ts`
- 国会図書館APIから ISBN 情報取得（`?isbn=...`）
- `app/api/gbooks/route.ts`
- Google Books APIから ISBN 情報取得（`?isbn=...`）
- `lib/server/book-store.ts`
- Apps Script 保存 / メモリ保存の切替
