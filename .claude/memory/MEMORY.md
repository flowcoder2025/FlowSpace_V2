# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 멀티에이전트 팀 시스템
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
| Epic | 상태 | Phase 진행 | 마지막 업데이트 |
|------|------|------------|-----------------|
| (없음) | 다음: Phase 10~11 | | 2026-02-19 |

## Completed Epics
| Epic | 완료일 | Phase 수 |
|------|--------|----------|
| ComfyUI Asset Pipeline | 2026-02-19 | Phase 1~7 |
| Map Editor | 2026-02-19 | Phase 8 |
| Admin Dashboard | 2026-02-19 | Phase 9 |

## Architecture Decisions
- 5개 도메인 에이전트 + 오케스트레이터 체제
- Contract Governance (FlowHR 패턴 적용)
- EventBridge (React ↔ Phaser 통신)
- Socket.io (Client ↔ Server 실시간)
- Next.js 15 App Router + Prisma 6 + PostgreSQL (Supabase)
- NextAuth v5 + JWT + PrismaAdapter
- eslint-config-next v16: `defineConfig` + direct import 방식
- 백그라운드 에이전트 Write/Bash 권한 없음 → 오케스트레이터 직접 실행
- 소켓 인증: `/api/socket/token` → jose JWT 발급 → 서버 검증
- Admin Dashboard: requireSpaceAdmin 헬퍼 (OWNER/STAFF/superAdmin)

## Team Structure
| Agent | Domain | Status |
|-------|--------|--------|
| Game Engine | Phaser, Avatar, Tiles | Phase 5, 8 완료 |
| Asset Pipeline | ComfyUI, Processing | Phase 1, 7 완료 |
| Communication | Socket.io, Realtime | Phase 4, 6, 8 완료 |
| Frontend | Next.js, UI, Zustand | Phase 1~9 완료 |
| Backend | API, Prisma, Auth | Phase 2~3, 9 완료 |

## Domain Work Protocol (필수 - 반드시 준수)
> **이전 세션에서 팀 프로토콜 미준수 발생. 다음 규칙 반드시 적용:**
1. 도메인 작업 전 `personas/{domain}.md` + `contracts/{domain}.md` 읽기
2. 관련 `shared/*.md` (event-protocol, data-ownership 등) 확인
3. 작업 시 "🔧 [Agent명] 역할로 작업" 명시
4. 완료 시 컨트랙트 준수 사항 보고

## Completed Work

### Phase 1~8 (이전 세션 참조)
상세: `.claude/memory/logs/2026-02-19.md` Session 1~7

### Phase 9: 관리자 대시보드 ✅
- requireSpaceAdmin 권한 헬퍼 (OWNER/STAFF/superAdmin)
- `/dashboard/spaces/[id]` 라우트 + 사이드바 레이아웃
- Admin API 7개: stats, members, logs, announce, messages, messages/[id], analytics
- 대시보드 컴포넌트 8개: sidebar, stat-card, announce-form, member-table, event-log-table, message-moderation, usage-chart, space-settings-form
- SpaceEventType에 ADMIN_ACTION 추가
- SpaceCard에 Dashboard 링크 (OWNER/STAFF)
- **20 신규, 3 수정** (tsc ✅ lint ✅)

### Codex 리스크 패치 (Phase 9 세션에서 처리)
- 워크플로우 API 경로 수정 (`/api/assets/workflows` → `/api/workflows`)
- 진행률 표시 STATUS_PROGRESS 매핑 (status 기반)
- 에셋 삭제 시 파일시스템 정리 (fs/promises.unlink)
- useChatStorage 통합 (useChat에 spaceId + localStorage 캐싱)

### Codex 보안 감사 패치 (Ad-hoc) ✅
- **Critical**: 소켓 userId 위장 방지 (socket.data.userId 강제), 에셋 API IDOR (소유권 검증)
- **High**: 맵 API 멤버십 검증, STAFF→OWNER 상승 차단, 파티 메시지 스코프 수정
- **Medium**: 에셋 파일 경로 이중 public 수정, reply 페이로드 전달, 소켓 삭제 DB 반영
- **Low**: 포탈 링크 양방향 업데이트
- 11파일 수정 (tsc ✅ lint ✅)

## Next Steps (Phase 10~)
1. Phase 10: LiveKit 음성/화상
2. Phase 11: 배포
3. ⚠️ `npx next build` 확인 필요 (dev 서버 종료 후 실행)

## Supabase DB 연결 정보
- Host: `aws-1-ap-southeast-2.pooler.supabase.com`
- Ref: `afdfkpxsfuyccdvrkqwu`
- Direct URL이 IPv6만 반환 → Session Pooler(:5432) 사용
- Prisma directUrl에 pooler URL 사용 중

## Key References (flow_metaverse)
- EventBridge: `src/features/space/game/events.ts`
- AssetRegistry: `src/config/asset-registry.ts`
- Avatar: `src/features/space/avatar/config.ts`
- MainScene: `src/features/space/game/scenes/MainScene.ts` (1661줄 → 분할 완료)
- Socket types: `src/features/space/socket/types.ts`

## Technical Notes
- npm install 완료, node_modules 존재
- prisma generate + db push 완료 (ADMIN_ACTION enum 포함)
- DB seed 완료 (테스트 계정: test@flowspace.dev / password123)
- build 결과: 29+ 라우트 (tsc ✅ eslint ✅)
- 개발서버: `npm run dev` (3000) / `npm run dev:all` (3000+3001)

## Lessons (프로젝트 로컬)
- Supabase direct URL IPv6만 반환 시 → session pooler URL(:5432) 대체 사용
- NextAuth v5 JWT는 JWE(암호화) → 별도 서버에서 디코딩 어려움 → 별도 토큰 발급 API 사용
- `eslint-config-next v16`: refs during render 에러 → state로 전환 필요
- Phaser `textures.addSpriteSheet(key, canvas)` → TS 타입 불일치 → `as unknown as HTMLImageElement` 캐스트 필요
- Prisma generate EPERM: dev 서버가 DLL 잠금 → 서버 종료 후 `npx prisma generate` 실행
- Socket.io: 인증 미들웨어의 socket.data.userId를 항상 신뢰, 클라이언트 전송 userId 무시
- API 설계: 쿼리 파라미터로 userId 받지 않기 (세션에서 강제 추출)
- 에셋 저장 경로: DB에는 `/assets/...` 형태, 파일시스템에는 `public/assets/...`로 저장 (이중 public 방지)
- 역할 변경 API: 호출자 역할 < 대상 역할 설정 불가 원칙 적용
