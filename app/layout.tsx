import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FRET / STEP — ギターTABトレーナー",
  description:
    "TAB譜が読めなくても、1音ずつ場所を確かめながらリードギターを練習できるトレーナー。",
  openGraph: {
    title: "FRET / STEP — ギターTABトレーナー",
    description: "動画・TAB・Ampero入力を同期して、リード／バッキングを曲ごとに練習。",
    images: [{ url: "/fret-step-social.png", width: 1200, height: 630, alt: "発光するギターフレットと音声波形" }],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FRET / STEP — ギターTABトレーナー",
    description: "動画・TAB・Ampero入力を同期してギターを練習。",
    images: ["/fret-step-social.png"],
  },
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
