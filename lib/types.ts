export type BookRecord = {
  id: string;
  createdAt: string;
  isbn: string;
  domain: string;
  subject: string;
  title: string;
  author: string;
  publisher: string;
  publishedDate: string;
  note: string;
};

export type NewBookInput = {
  isbn: string;
  domain: string;
  subject: string;
  title: string;
  author?: string;
  publisher?: string;
  publishedDate?: string;
  note?: string;
};

export type BookFilters = {
  keyword?: string;
  startDate?: string;
  endDate?: string;
  domain?: string;
  subject?: string;
};
