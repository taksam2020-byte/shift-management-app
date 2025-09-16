import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import AuthProvider from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "シフト管理システム",
  description: "従業員のシフト管理アプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full bg-gray-50">
      <body className={`${inter.className} h-full flex flex-col`}>
        <Header />
        <main className="flex-grow overflow-y-auto">
          <AuthProvider>{children}</AuthProvider>
        </main>
      </body>
    </html>
  );
}
