import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "書籍登録・検索アプリ",
  description: "書籍の登録と検索を Google スプレッドシート連携で行うアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
