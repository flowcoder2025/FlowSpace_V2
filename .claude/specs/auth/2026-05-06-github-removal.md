# Auth: GitHub OAuth 제거 — Google + Credentials 2체제 단순화

**날짜**: 2026-05-06
**유형**: Ad-hoc (정리성 변경)

## 개요

GitHub OAuth provider를 제거하고 Google OAuth + Credentials(이메일/비밀번호) 2체제로 인증을 단순화.
GitHub provider는 변경 전에도 환경변수가 비어있어 비활성 상태였으므로, 실질적으로 코드/UI 정리 작업.

## 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src/lib/auth.config.ts` | 수정 | GitHub provider import 및 조건부 블록 제거 |
| `src/components/auth/oauth-buttons.tsx` | 수정 | GitHub 버튼 제거, Google 버튼만 유지 |
| `.env.example` | 수정 | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 라인 삭제 |

## 주요 구현

### auth.config.ts — 최종 상태

```typescript
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

Google provider는 `GOOGLE_CLIENT_ID` 환경변수 존재 여부로 조건부 활성화.
Edge Runtime 호환 구조 유지 (`Prisma`/`bcryptjs` 미포함).

### oauth-buttons.tsx — 최종 상태

```typescript
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

interface OAuthButtonsProps {
  callbackUrl: string;
}

export function OAuthButtons({ callbackUrl }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuth = (provider: string) => {
    setLoading(provider);
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Google SVG icon */}
        {loading === "google" ? "Connecting..." : "Continue with Google"}
      </button>
    </div>
  );
}
```

### .env.example — OAuth Providers 섹션

```env
# ============================================
# OAuth Providers (optional)
# ============================================
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

GitHub 관련 변수 라인 삭제됨.

## 인프라 변경

### Google Cloud Console 설정

- OAuth 2.0 클라이언트 유형: **Web Application**
- 승인된 리디렉션 URI:
  - `http://localhost:3000/api/auth/callback/google` (로컬)
  - `https://flowspace-v2.vercel.app/api/auth/callback/google` (프로덕션)
- OAuth 동의 화면: **테스트 모드**

### Vercel 환경변수

| 변수 | 환경 |
|------|------|
| `GOOGLE_CLIENT_ID` | Production |
| `GOOGLE_CLIENT_SECRET` | Production |

로컬 `.env`에도 동일하게 설정됨.

## 비고

- **사전 상태**: GitHub provider 코드/UI 존재했으나 환경변수 미설정으로 비활성 상태. 실질적으로 데드 코드.
- **OAuth 동의 화면 테스트 모드 제약**: `vercel.app`은 Public Suffix List(PSL) 도메인이라 Google OAuth 동의 화면의 승인된 도메인으로 등록 불가. 현재 테스트 모드로 운영 중. 커스텀 도메인 연결 후 Production 전환 필요.
- **후속 작업**: 커스텀 도메인(예: `flowspace.app`) 연결 → Google OAuth 동의 화면 프로덕션 전환 → 리디렉션 URI 추가.
