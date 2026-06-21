# Auth: 스페이스 생성 슈퍼어드민 전용 제한 + 슈퍼어드민 부트스트랩

**날짜**: 2026-06-21
**유형**: WI-007-feat (접근제어)
**머지**: main `2a6e2ed` (PR#3) · develop back-sync `d8495f9` · 라이브 배포 `38459d5`
**검증**: 기계게이트 tsc/lint/vitest/build PASS (main 베이스 자기완결성 실증) · 듀얼검증 codex PASS · evaluator WARNING 9.85 (P3×2 defer→WI-008)

## 개요

스페이스 생성을 **슈퍼어드민(`User.isSuperAdmin`) 전용**으로 제한한다. 생성된 스페이스의 OWNER 권한은 이후 멤버 역할 위임(`PATCH /api/spaces/[id]/members`)으로 분배하는 모델. 슈퍼어드민 플래그는 UI가 아닌 스크립트로만 부여하는 신뢰 부트스트랩.

## 변경 파일 (6)

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/app/api/spaces/route.ts` | 수정 | POST에 `isSuperAdmin !== true → 403` 가드 (`prisma.space.create` 단일 경로의 최후 방어선) |
| `src/app/spaces/new/page.tsx` | 수정 | 비-슈퍼어드민 서버 `redirect("/my-spaces")` |
| `src/app/my-spaces/page.tsx` | 수정 | `SpaceListView`에 `isSuperAdmin` prop 전달 |
| `src/components/spaces/space-list-view.tsx` | 수정 | toolbar + empty-state 생성 버튼을 `isSuperAdmin` 조건화 |
| `src/components/layout/navbar.tsx` | 수정 | 전역 '새 스페이스' CTA(데스크톱+모바일) `session.user.isSuperAdmin` 조건화 |
| `scripts/set-super-admin.mjs` | 신규 | 슈퍼어드민 부트스트랩 (멱등, 미존재 사용자 명확 실패, `--list`) |

## 보안 레이어 구조

```
[scripts/set-super-admin.mjs] → DB User.isSuperAdmin 직접 설정 (멱등, --list)
        ↓ (로그인 시 1회 토큰에 snapshot)
[JWT token.isSuperAdmin]      ← auth.config.ts jwt 콜백 (user 있을 때만)
        ↓
[session.user.isSuperAdmin]   ← auth.config.ts session 콜백
        ↓
[POST /api/spaces]            → isSuperAdmin !== true → 403  (서버측 단일 차단점, 최후 방어선)
[/spaces/new page]            → isSuperAdmin !== true → redirect("/my-spaces")
[Navbar CTA / SpaceListView]  → isSuperAdmin 조건부 렌더링 (진입점 전수 게이팅)
```

## 주요 제약 / 운영 주의

- **NextAuth JWT 전략** → `isSuperAdmin`은 로그인 시점에만 토큰에 박힘. 플래그 변경 후 **반드시 재로그인**해야 기존 세션에 반영.
- `isSuperAdmin` 변경은 `scripts/set-super-admin.mjs` 단일 경로 (UI 관리 경로 없음 — 신뢰 부트스트랩).
- 현재 슈퍼어드민: `admin@flowspace.dev`, `kryou2922@gmail.com`.
- `requireSpaceAdmin()` / `canActOn()` — 슈퍼어드민은 역할 계층 무시하고 항상 통과 (어느 스페이스 대시보드든 직접 URL 접근 + 역할 위임 가능).

## 배포 함정 (기록)

- Vercel 프로덕션은 `main` 브랜치 배포. main 머지커밋(`2a6e2ed`) 프로덕션 배포가 **Git 작성자 인가 차단**(`team-members-and-roles`)으로 실패 → 라이브가 구버전 유지됨.
- 해결: 커밋 작성자를 인가 계정(`flowcoder25@gmail.com`)으로 바꿔 빈 커밋(`38459d5`) 푸시 → 프로덕션 배포 성공. (GitHub Actions 빌드는 성공이었음 — Vercel 인가 단계의 문제)

## 알려진 한계 / 후속

- **슈퍼어드민 전역 스페이스 뷰 미구현**: `GET /api/spaces`는 "내가 멤버인 스페이스"만 반환 → 슈퍼어드민도 멤버 아닌 스페이스는 목록·카드에 안 보이고 '관리' 버튼도 안 뜸(`space-card.tsx`의 `isAdmin = myRole` 기준). 백엔드 인가는 통과하므로 직접 URL 접근은 가능하나 UI 진입점이 없음. → 후속 WI(전역 뷰).
- P3×2 (WI-008-fix): `set-super-admin.mjs` 회수 인자 엄격화, `POST /api/spaces` 403 `code` 필드 일관화.
