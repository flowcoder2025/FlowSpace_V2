---
paths:
  - "src/app/**"
  - "src/components/**"
  - "src/stores/**"
  - "src/lib/**"
  - "prisma/**"
  - "src/features/space/editor/**"
  - "src/features/space/chat/**"
---

# App Domain

Next.js 15 풀스택 — 서버(API/Prisma/인증) + 클라이언트(UI/Zustand/라우팅)

## Server Invariants

1. **DB 독점**: 다른 도메인은 반드시 API 경유 (직접 Prisma import 금지)
2. **select/include 명시**: Prisma 쿼리에 항상 필요한 필드만 선택
3. **세션 userId 강제**: API에서 query parameter userId 불신, `session.user.id` 사용
4. **에러 형식 통일**: `{ error: string, code?: string }` JSON 응답
5. **인증 가드**: `requireSpaceAdmin(spaceId)` → OWNER/STAFF/superAdmin만 허용
6. **역할 변경 원칙**: 호출자 역할 ≤ 대상 역할 설정 불가

## Client Invariants

7. **서버 컴포넌트 우선**: `"use client"` 최소화, 필요 시 명시
8. **Phaser 직접 호출 금지**: EventBridge 경유만 허용
9. **하드코딩 금지**: 상수는 `constants/` 분리, 환경별 값은 환경변수
10. **컴포넌트 2회 반복 시 분리**: 공통 컴포넌트는 `components/` 배치
11. **useState lazy init**: localStorage 읽기 시 lazy initializer 사용 (useEffect setState → lint 에러)

## Common

12. **Prisma generate EPERM**: dev 서버 DLL 잠금 → 서버 종료 후 실행
13. **NextAuth v5 JWT**: JWE 암호화 → 별도 서버 디코딩 시 `/api/socket/token` 사용
