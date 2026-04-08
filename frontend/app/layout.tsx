import type { Metadata, Viewport } from "next";
import "./globals.css";

// 视口配置
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050507" },
    { media: "(prefers-color-scheme: light)", color: "#050507" }
  ],
};

// 元数据配置
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
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
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
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
        {/* 预取下一页 */}
        <link rel="prefetch" href="/dashboard" />
      </head>
      <body className="antialiased bg-[#050507] text-[#f2f2f2] font-sans selection:bg-[#00d992] selection:text-black">
        {/* Hardware terminal atmosphere */}
        <div className="bg-noise fixed inset-0 z-[9998] pointer-events-none opacity-[0.03]" />
        <div className="scanline-overlay fixed inset-0 z-[9999] pointer-events-none opacity-[0.1]" />
        
        {children}
      </body>
    </html>
  );
}
