# Phase 9: 관리자 대시보드

> Epic: [admin-dashboard](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
공간 관리자(OWNER/STAFF)가 웹 대시보드에서 공간을 관리할 수 있도록 한다.

## Task 목록
- [x] Task 9.1: 관리자 라우트 보호 (Foundation)
- [x] Task 9.2: 공간 대시보드 (Stats Overview)
- [x] Task 9.3: 멤버 관리
- [x] Task 9.4: 이벤트 로그
- [x] Task 9.5: 공지사항
- [x] Task 9.6: 메시지 관리 (모더레이션)
- [x] Task 9.7: 사용량 분석
- [x] Task 9.8: 공간 설정

## 구현 상세

### Task 9.1: 관리자 라우트 보호
**파일:** `src/lib/admin-guard.ts`, `src/app/dashboard/spaces/[id]/layout.tsx`, `src/components/dashboard/dashboard-sidebar.tsx`

```typescript
// requireSpaceAdmin(spaceId) → { userId, spaceId, role, isSuperAdmin }
// 미인증 → redirect("/login")
// 권한없음 → redirect("/my-spaces")
// OWNER, STAFF, superAdmin만 접근 가능
```

사이드바: Overview, Members, Messages, Logs, Analytics, Settings 6개 메뉴.

### Task 9.2: 공간 대시보드
**API:** `GET /api/spaces/[id]/admin/stats`
```typescript
// 반환: { memberCount, messageCount, todayMessageCount, recentActivity[] }
```
**페이지:** `src/app/dashboard/spaces/[id]/page.tsx` (클라이언트 컴포넌트)
- StatCard 3개 (멤버수, 총 메시지, 오늘 메시지)
- AnnounceForm (Task 9.5 통합)
- 최근 활동 목록

### Task 9.3: 멤버 관리
**API:** `GET/PATCH /api/spaces/[id]/admin/members`
```typescript
// PATCH body: { memberId, action: "changeRole"|"mute"|"unmute"|"kick"|"ban", role? }
// OWNER 보호: OWNER 역할은 수정 불가
// 모든 액션에 SpaceEventLog(ADMIN_ACTION) 기록
```
**컴포넌트:** `MemberTable` — 역할 배지 + 제한 상태 + 액션 드롭다운

### Task 9.4: 이벤트 로그
**API:** `GET /api/spaces/[id]/admin/logs?cursor=&eventType=&limit=`
- cursor 페이지네이션 (기본 50, 최대 100)
- eventType 필터 (ENTER, EXIT, CHAT, INTERACTION, ADMIN_ACTION)

### Task 9.5: 공지사항
**API:** `POST /api/spaces/[id]/admin/announce`
```typescript
// body: { content }
// ChatMessage(type=ANNOUNCEMENT) 생성 + SpaceEventLog 기록
```

### Task 9.6: 메시지 모더레이션
**API:**
- `GET /api/spaces/[id]/admin/messages` — 전체 메시지 (cursor 페이지네이션)
- `DELETE /api/spaces/[id]/admin/messages/[messageId]` — soft delete
```typescript
// soft delete: isDeleted=true, deletedBy, deletedAt 설정
```

### Task 9.7: 사용량 분석
**API:** `GET /api/spaces/[id]/admin/analytics?days=14`
```sql
-- 일별 메시지 집계
SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
FROM "ChatMessage" WHERE "spaceId" = $1 AND "createdAt" >= $2
GROUP BY DATE_TRUNC('day', "createdAt") ORDER BY date ASC

-- 일별 방문자 집계 (동일 패턴, SpaceEventLog ENTER)
```
**컴포넌트:** `UsageChart` — Tailwind CSS 기반 바 차트 (hover 툴팁)

### Task 9.8: 공간 설정
기존 `PATCH /api/spaces/[id]` 재사용.
**필드:** name, description, maxUsers, accessType, primaryColor, loadingMessage

## 스키마 변경
```prisma
enum SpaceEventType {
  ENTER
  EXIT
  INTERACTION
  CHAT
  ADMIN_ACTION  // ← 추가
}
```

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `prisma/schema.prisma` | 수정 | ADMIN_ACTION enum 추가 |
| `src/constants/navigation.ts` | 수정 | DASHBOARD 경로 6개 추가 |
| `src/components/spaces/space-card.tsx` | 수정 | Dashboard 링크 추가 (OWNER/STAFF) |
| `src/lib/admin-guard.ts` | 추가 | requireSpaceAdmin 헬퍼 |
| `src/app/dashboard/spaces/[id]/layout.tsx` | 추가 | 대시보드 레이아웃 |
| `src/app/dashboard/spaces/[id]/page.tsx` | 추가 | Overview 페이지 |
| `src/app/dashboard/spaces/[id]/members/page.tsx` | 추가 | 멤버 관리 페이지 |
| `src/app/dashboard/spaces/[id]/messages/page.tsx` | 추가 | 메시지 모더레이션 |
| `src/app/dashboard/spaces/[id]/logs/page.tsx` | 추가 | 이벤트 로그 |
| `src/app/dashboard/spaces/[id]/analytics/page.tsx` | 추가 | 사용량 분석 |
| `src/app/dashboard/spaces/[id]/settings/page.tsx` | 추가 | 공간 설정 |
| `src/app/api/spaces/[id]/admin/stats/route.ts` | 추가 | Stats API |
| `src/app/api/spaces/[id]/admin/members/route.ts` | 추가 | Members API |
| `src/app/api/spaces/[id]/admin/logs/route.ts` | 추가 | Logs API |
| `src/app/api/spaces/[id]/admin/announce/route.ts` | 추가 | Announce API |
| `src/app/api/spaces/[id]/admin/messages/route.ts` | 추가 | Messages API |
| `src/app/api/spaces/[id]/admin/messages/[messageId]/route.ts` | 추가 | Message Delete API |
| `src/app/api/spaces/[id]/admin/analytics/route.ts` | 추가 | Analytics API |
| `src/components/dashboard/dashboard-sidebar.tsx` | 추가 | 사이드바 |
| `src/components/dashboard/stat-card.tsx` | 추가 | 통계 카드 |
| `src/components/dashboard/announce-form.tsx` | 추가 | 공지 폼 |
| `src/components/dashboard/member-table.tsx` | 추가 | 멤버 테이블 |
| `src/components/dashboard/event-log-table.tsx` | 추가 | 이벤트 로그 테이블 |
| `src/components/dashboard/message-moderation.tsx` | 추가 | 메시지 모더레이션 |
| `src/components/dashboard/usage-chart.tsx` | 추가 | 사용량 차트 |
| `src/components/dashboard/space-settings-form.tsx` | 추가 | 설정 폼 |
