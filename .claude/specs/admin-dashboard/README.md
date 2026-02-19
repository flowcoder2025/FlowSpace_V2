# Epic: Admin Dashboard (Phase 9)

> 상태: **완료** | 시작: 2026-02-19 | 완료: 2026-02-19

## 개요
공간 관리자(OWNER/STAFF)를 위한 웹 기반 대시보드.
통계, 멤버 관리, 메시지 모더레이션, 이벤트 로그, 분석, 공지사항, 설정 기능 제공.

## Phase 목록
| Phase | 이름 | 상태 | Task 수 |
|-------|------|------|---------|
| 9 | 관리자 대시보드 | ✅ 완료 | 8 |

## 아키텍처 결정
- **권한 검증**: `requireSpaceAdmin()` 서버 헬퍼 (OWNER/STAFF/superAdmin)
- **라우트 구조**: `/dashboard/spaces/[id]/*` (Next.js App Router)
- **API 패턴**: `/api/spaces/[id]/admin/*` (cursor 페이지네이션)
- **차트**: Tailwind CSS 기반 바 차트 (외부 라이브러리 미사용)
- **설정**: 기존 `PATCH /api/spaces/[id]` API 재사용

## 관련 파일
- `src/lib/admin-guard.ts` — 권한 검증 헬퍼
- `src/app/dashboard/` — 대시보드 페이지
- `src/app/api/spaces/[id]/admin/` — Admin API
- `src/components/dashboard/` — 대시보드 컴포넌트
