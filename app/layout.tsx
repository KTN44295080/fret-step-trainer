import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FRET / STEP — ギターTABトレーナー",
  description:
    "TAB譜が読めなくても、1音ずつ場所を確かめながらリードギターを練習できるトレーナー。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
