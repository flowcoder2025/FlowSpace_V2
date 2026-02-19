# Phase 2-3: DB 연결 + 인증 + 공간 시스템

> Epic: [ComfyUI Asset Pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
1. Supabase PostgreSQL 연결
2. NextAuth v5 인증 (Credentials + OAuth)
3. 공간(Space) CRUD + 멤버 관리

## 구현 상세

### NextAuth v5 설정
```typescript
// src/lib/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [Google, GitHub, Credentials],
  callbacks: { jwt, session },
});
```

### API 엔드포인트
| Method | Path | Description |
|--------|------|-------------|
| * | `/api/auth/[...nextauth]` | NextAuth 핸들러 |
| POST | `/api/auth/register` | 회원가입 (bcrypt) |
| GET/PATCH | `/api/users/me` | 프로필 조회/수정 |
| POST/GET | `/api/guest` | 게스트 세션 생성/검증 |
| GET/POST | `/api/spaces` | 공간 목록/생성 |
| GET/PATCH/DELETE | `/api/spaces/[id]` | 공간 상세/수정/삭제 |
| GET/POST/PATCH | `/api/spaces/[id]/members` | 멤버 관리 |
| GET/POST | `/api/spaces/join/[inviteCode]` | 초대 참여 |

### 변경 파일 (28파일)
- Phase 2: 17파일 (auth, login UI, profile API, guest, seed)
- Phase 3: 11파일 (spaces API, UI 3페이지, store)

## Level 1 검증: tsc ✅ | eslint ✅ | build ✅ (22 라우트)
