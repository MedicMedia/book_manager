type ApiKey = "sheet-search" | "sheet-register" | "sheet-delete" | "ndl" | "gbooks";

const API_LABEL: Record<ApiKey, string> = {
  "sheet-search": "/api/sheet（検索）",
  "sheet-register": "/api/sheet（登録）",
  "sheet-delete": "/api/sheet（削除）",
  ndl: "/api/ndl（国会図書館API連携）",
  gbooks: "/api/gbooks（Google Books API連携）",
};

const API_CAUSES: Record<ApiKey, string[]> = {
  "sheet-search": [
    "ネットワーク接続が切れている",
    "Next.js サーバーが停止している",
    "Apps Script のデプロイURL / 公開設定 / トークン設定が不正",
  ],
  "sheet-register": [
    "ネットワーク接続が切れている",
    "Next.js サーバーが停止している",
    "Apps Script のデプロイURL / 公開設定 / トークン設定が不正",
  ],
  "sheet-delete": [
    "ネットワーク接続が切れている",
    "Next.js サーバーが停止している",
    "Apps Script のデプロイURL / 公開設定 / トークン設定が不正",
  ],
  ndl: [
    "ネットワーク接続が切れている",
    "国会図書館API側の一時障害 / レート制限",
    "ISBNが未収載または形式不正",
  ],
  gbooks: [
    "ネットワーク接続が切れている",
    "Google Books API側の一時障害 / レート制限",
    "ISBNが未収載または形式不正",
  ],
};

const isNetworkLikeError = (message: string) => {
  return /fetch failed|failed to fetch|networkerror|load failed|network request failed/i.test(message);
};

const isJsonParseLikeError = (message: string) => {
  return /unexpected token|json/i.test(message);
};

const joinCauses = (key: ApiKey) => API_CAUSES[key].map((cause) => `・${cause}`).join(" ");

const buildMessage = (key: ApiKey, detail: string) => {
  return `${API_LABEL[key]} でエラー: ${detail} 原因候補: ${joinCauses(key)}`;
};

export const formatApiHttpError = (key: ApiKey, status: number, detail?: string) => {
  const statusDetail = detail?.trim() ? `HTTP ${status} (${detail.trim()})` : `HTTP ${status}`;
  return buildMessage(key, statusDetail);
};

export const formatApiCaughtError = (key: ApiKey, error: unknown) => {
  if (error instanceof Error) {
    const message = error.message?.trim() ?? "";
    if (message.includes("原因候補:") && message.includes(API_LABEL[key])) {
      return message;
    }
    if (isNetworkLikeError(message)) {
      return buildMessage(key, "通信に失敗しました（ネットワークエラー）");
    }
    if (isJsonParseLikeError(message)) {
      return buildMessage(key, "APIレスポンスの解析に失敗しました");
    }
    if (message.length > 0) {
      return buildMessage(key, message);
    }
  }
  return buildMessage(key, "不明なエラーが発生しました");
};
