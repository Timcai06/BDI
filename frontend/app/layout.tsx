import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "桥梁病害识别系统",
  description: "单图识别 MVP，用于桥梁无人机巡检病害检测与展示。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
