import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { NavbarWrapper } from "@/components/layout";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FlowSpace — 다 함께 모이는 가상의 사무실",
  description: "팀이 매일 출근하는 공간을 직접 디자인하고, 음성과 영상으로 실시간 연결됩니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={sourceSerif.variable}>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <SessionProvider>
          <NavbarWrapper />
          <div className="flex-1">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}
