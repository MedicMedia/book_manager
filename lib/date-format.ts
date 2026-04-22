const BOOK_DATE_PATTERN = /^\d{4}(\/\d{1,2}(\/\d{1,2})?)?$/;
const normalizeDateText = (value: string) => value.trim().replace(/[.-]/g, "/").replace(/T.+$/i, "").replace(/\s.+$/i, "");

export const isValidBookDateInput = (value: string) => {
  const trimmed = normalizeDateText(value);
  if (trimmed.length === 0) {
    return true;
  }

  if (!BOOK_DATE_PATTERN.test(trimmed)) {
    return false;
  }

  const [yearText, monthText, dayText] = trimmed.split("/");
  const year = Number(yearText);

  if (!Number.isInteger(year) || yearText.length !== 4 || year < 1) {
    return false;
  }

  if (!monthText) {
    return true;
  }

  const month = Number(monthText);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  if (!dayText) {
    return true;
  }

  const day = Number(dayText);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
};

export const parseBookDateBoundary = (value: string | undefined, boundary: "start" | "end") => {
  if (!value) {
    return null;
  }

  const normalized = normalizeDateText(value);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split("/");
  const [yearText, monthText, dayText] = parts;

  if (!/^\d{4}$/.test(yearText ?? "")) {
    return null;
  }

  const year = Number(yearText);
  if (!Number.isInteger(year) || year < 1) {
    return null;
  }

  if (parts.length === 1) {
    if (boundary === "start") {
      return new Date(Date.UTC(year, 0, 1)).getTime();
    }
    return new Date(Date.UTC(year, 11, 31)).getTime();
  }

  if (!monthText || !/^\d{1,2}$/.test(monthText)) {
    return null;
  }

  const month = Number(monthText);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  if (parts.length === 2) {
    if (boundary === "start") {
      return new Date(Date.UTC(year, month - 1, 1)).getTime();
    }
    return new Date(Date.UTC(year, month, 0)).getTime();
  }

  if (!dayText || !/^\d{1,2}$/.test(dayText)) {
    return null;
  }

  const day = Number(dayText);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.getTime();
};

export const isReversedDateRange = (startDate: string, endDate: string) => {
  const startAt = parseBookDateBoundary(startDate, "start");
  const endAt = parseBookDateBoundary(endDate, "end");
  if (startAt === null || endAt === null) {
    return false;
  }
  return startAt > endAt;
};
