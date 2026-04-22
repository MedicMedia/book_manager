const SHEET_NAME = "シート1";
const HEADER_ROW = [
  "ID",
  "登録日",
  "ISBN",
  "領域",
  "科目",
  "書籍名",
  "著者名",
  "出版社名",
  "発売日",
  "備考",
];

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const token = payload.token || "";
    const expectedToken = PropertiesService.getScriptProperties().getProperty("API_TOKEN");

    if (!token || token !== expectedToken) {
      return json({ ok: false, error: "unauthorized" });
    }

    if (payload.action === "list") {
      const rows = listBooks_();
      return json({ ok: true, data: rows });
    }

    if (payload.action === "create") {
      const created = withScriptLock_(function () {
        ensureHeaderRow_();
        return createBook_(payload.book || {});
      });
      return json({ ok: true, data: created });
    }

    if (payload.action === "update") {
      const updated = withScriptLock_(function () {
        ensureHeaderRow_();
        return updateBook_(payload.id, payload.book || {});
      });
      return json({ ok: true, data: updated });
    }

    if (payload.action === "delete") {
      const deleted = withScriptLock_(function () {
        ensureHeaderRow_();
        return deleteBook_(payload.id);
      });
      return json({ ok: true, data: deleted });
    }

    return json({ ok: false, error: "unknown_action" });
  } catch (error) {
    return json({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function withScriptLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function ensureHeaderRow_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error("sheet_not_found");
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER_ROW);
    return;
  }

  const existing = sheet.getRange(1, 1, 1, HEADER_ROW.length).getValues()[0];
  const current = existing.map((v) => String(v));
  if (current.join("|") !== HEADER_ROW.join("|")) {
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
  }
}

function listBooks_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error("sheet_not_found");
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADER_ROW.length).getValues();
  return values
    .map((row) => toBookObject_(row))
    .sort((a, b) => String(b["登録日"]).localeCompare(String(a["登録日"])));
}

function createBook_(book) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error("sheet_not_found");
  }

  const id = Utilities.getUuid();
  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  const isbn = String(book.isbn || "").replace(/-/g, "").trim();

  const row = [
    id,
    now,
    isbn,
    sanitizeForSheetText_(book.domain),
    sanitizeForSheetText_(book.subject),
    sanitizeForSheetText_(book.title),
    sanitizeForSheetText_(book.author),
    sanitizeForSheetText_(book.publisher),
    sanitizeForSheetText_(book.publishedDate),
    sanitizeForSheetText_(book.note),
  ];

  sheet.appendRow(row);
  return toBookObject_(row);
}

function updateBook_(id, book) {
  const targetId = String(id || "").trim();
  if (!targetId) {
    throw new Error("missing_id");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error("sheet_not_found");
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error("not_found");
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADER_ROW.length).getValues();
  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");

  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const rowId = String(row[0]);
    if (rowId === targetId) {
      const updatedRow = [
        rowId,
        now,
        String(book.isbn || "").replace(/-/g, "").trim(),
        sanitizeForSheetText_(book.domain),
        sanitizeForSheetText_(book.subject),
        sanitizeForSheetText_(book.title),
        sanitizeForSheetText_(book.author),
        sanitizeForSheetText_(book.publisher),
        sanitizeForSheetText_(book.publishedDate),
        sanitizeForSheetText_(book.note),
      ];

      const sheetRow = index + 2;
      sheet.getRange(sheetRow, 1, 1, HEADER_ROW.length).setValues([updatedRow]);
      return toBookObject_(updatedRow);
    }
  }

  throw new Error("not_found");
}

function deleteBook_(id) {
  const targetId = String(id || "").trim();
  if (!targetId) {
    throw new Error("missing_id");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error("sheet_not_found");
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error("not_found");
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HEADER_ROW.length).getValues();

  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const rowId = String(row[0]);
    if (rowId === targetId) {
      const sheetRow = index + 2;
      sheet.deleteRow(sheetRow);
      return { id: targetId };
    }
  }

  throw new Error("not_found");
}

function toBookObject_(row) {
  const obj = {};
  HEADER_ROW.forEach((key, index) => {
    obj[key] = row[index];
  });
  return obj;
}

function sanitizeForSheetText_(value) {
  const raw = String(value == null ? "" : value);

  // Spreadsheet formula injection guard:
  // Leading spaces/tabs/newlines + =, +, -, @ are treated as formulas by spreadsheet apps.
  if (/^[\s\u0009\u000a\u000d]*[=+\-@]/.test(raw)) {
    return "'" + raw;
  }
  return raw;
}

function json(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}
