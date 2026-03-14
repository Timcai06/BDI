import type { Metadata, Viewport } from "next";
import "./globals.css";

// 视口配置
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B1120" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" }
  ],
};

// 元数据配置
export const metadata: Metadata = {
  title: {
    default: "BDI Nexus | 桥梁病害智能判读系统",
    template: "%s | BDI Nexus"
  },
  description: "AI驱动的桥梁基础设施巡检解决方案，从图像上传到报告导出的一站式智能判读工作台。支持多种病害类型识别，算法可插拔设计。",
  keywords: ["桥梁检测", "AI识别", "基础设施", "智能巡检", "病害判读", "YOLO", "深度学习"],
  authors: [{ name: "BDI Team" }],
  creator: "BDI Nexus",
  publisher: "BDI Nexus",
  
  // Open Graph
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://bdi-nexus.example.com",
    siteName: "BDI Nexus",
    title: "BDI Nexus | 桥梁病害智能判读系统",
    description: "AI驱动的桥梁基础设施巡检解决方案",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BDI Nexus - 桥梁病害智能判读系统"
      }
    ]
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "BDI Nexus | 桥梁病害智能判读系统",
    description: "AI驱动的桥梁基础设施巡检解决方案",
    images: ["/og-image.png"]
  },

  // 搜索引擎验证（需要替换为实际的验证代码）
  verification: {
    google: "your-google-verification-code",
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // 图标
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },

  // 其他
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" dir="ltr">
      <head>
        {/* DNS 预解析 */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* 预加载关键资源 */}
        <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        
        {/* 预取下一页 */}
        <link rel="prefetch" href="/dashboard" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
