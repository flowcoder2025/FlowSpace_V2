import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/session-provider";
import { NavbarWrapper } from "@/components/layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowSpace",
  description: "ComfyUI 기반 에셋 파이프라인을 갖춘 가상 공간 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col">
        <SessionProvider>
          <NavbarWrapper />
          <div className="flex-1">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}
