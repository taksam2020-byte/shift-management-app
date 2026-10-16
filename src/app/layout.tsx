import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { AuthProvider } from "@/components/AuthProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "シフト管理システム",
  description: "従業員のシフト管理アプリケーション",
  // iPhone で「ホーム画面に追加」したときのアプリ表示
  appleWebApp: { capable: true, title: "シフトくん", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#1f2937",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full bg-gray-50">
      <body className={`${inter.className} h-full flex flex-col`}>
        <ServiceWorkerRegister />
        <AuthProvider>
          <Header />
          <main className="flex-grow overflow-y-auto">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
