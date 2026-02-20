# FlowSpace Project Memory

## Project Overview
- **Name**: FlowSpace
- **Type**: flow_metaverse 리팩토링 프로젝트
- **Goal**: ComfyUI 기반 에셋 파이프라인 + 메타버스 플랫폼
- **Repo**: https://github.com/flowcoder2025/FlowSpace_V2.git

## Active Epic
| Epic | 상태 | Phase 진행 | 마지막 업데이트 |
|------|------|------------|-----------------|
| (없음) | | | |

## Completed Epics
| Epic | 완료일 | Phase 수 |
|------|--------|----------|
| ComfyUI Asset Pipeline | 2026-02-19 | Phase 1~7 |
| Map Editor | 2026-02-19 | Phase 8 |
| Admin Dashboard | 2026-02-19 | Phase 9 |
| Chat Port (flow_metaverse → FlowSpace) | 2026-02-20 | Phase 10 (6 sub-phases) |
| LiveKit 음성/화상 포팅 | 2026-02-20 | Phase 11 (통합+QA) |

## Architecture Decisions
- 6 도메인 rules (`.claude/rules/` path-based auto-load) — game-engine, asset-pipeline, communication, app, data-ownership, asset-spec
- event-protocol → `.claude/reference/` (173줄, 인간용 레퍼런스)
- 이전 `.claude/team/` 구조 → 공식 `.claude/rules/` 전환 완료 (2026-02-20)
- DocOps 220줄 → doc-agent + Stop hook 전환 완료 (2026-02-20)
- QA 프로세스: qa-agent (5-Gate 검증) + Stop hook 자동 제안 (2026-02-20)
- EventBridge (React ↔ Phaser 통신)
- Socket.io (Client ↔ Server 실시간)
- Next.js 15 App Router + Prisma 6 + PostgreSQL (Supabase)
- NextAuth v5 + JWT + PrismaAdapter
- eslint-config-next v16: `defineConfig` + direct import 방식
- 백그라운드 에이전트 Write/Bash 권한 없음 → 오케스트레이터 직접 실행
- 소켓 인증: `/api/socket/token` → jose JWT 발급 → 서버 검증
- Admin Dashboard: requireSpaceAdmin 헬퍼 (OWNER/STAFF/superAdmin)

## Completed Work

### Phase 1~8 (이전 세션 참조)
상세: `.claude/memory/logs/2026-02-19.md` Session 1~7

### Phase 9: 관리자 대시보드 ✅
- requireSpaceAdmin 권한 헬퍼 (OWNER/STAFF/superAdmin)
- `/dashboard/spaces/[id]` 라우트 + 사이드바 레이아웃
- Admin API 7개 + 대시보드 컴포넌트 8개
- **20 신규, 3 수정** (tsc ✅ lint ✅)

### Phase 10: Chat System Port ✅ (2026-02-20)
- **상수 추출**: `chat-constants.ts` (14개 매직넘버 → 공유 상수, 한/영 별칭 7쌍)
- **파서 업그레이드**: 한/영 관리자 별칭, 에디터 명령어 config 주입, 도움말 모듈
- **필터 업그레이드**: www./도메인 URL 감지, links 탭 시스템 제외, 크로스탭 안읽음, 50자 말줄임
- **소켓 회복력**: 30회 재연결 (500ms→5s 지수백오프), beforeunload/pagehide, socketError 상태
- **에러 세분화**: chat:error/whisper:error/party:error/admin:error (코드+메시지)
- **UI 강화**: ↑↓ 귓속말 히스토리, A-/A+ 폰트 3단계, playersMap SSOT 닉네임, URL <a> 렌더링
- **2 신규 + 17 수정** = 19파일 (tsc ✅ lint ✅)

### Codex 보안 감사 패치 (Ad-hoc) ✅
- 9건 패치 (Critical 2, High 3, Medium 3, Low 1)
- 11파일 수정 (tsc ✅ lint ✅)

## 에이전트 시스템 리팩토링 (2026-02-20) — ✅ 검증 완료
- rules auto-load: 6개 파일 YAML paths 포맷 정확 ✅
- Stop hooks: 3-레벨 중첩 + prompt 타입 + ok/reason 스키마 정확 ✅
- agents 스폰: frontmatter 필드 유효 + 시스템 프롬프트 포함 ✅

## Next Steps
1. ~~에이전트 시스템 검증~~ ✅ (2026-02-20)
2. ~~Phase 11: LiveKit 음성/화상/화면공유/녹화~~ ✅ 통합 완료 (2026-02-20)
3. Phase 11 실사용 테스트 (LiveKit 서버 + 브라우저 2개)
4. 배포 준비
5. ⚠️ `npx next build` 확인 필요 (dev 서버 종료 후 실행)

## Supabase DB 연결 정보
- Host: `aws-1-ap-southeast-2.pooler.supabase.com`
- Ref: `afdfkpxsfuyccdvrkqwu`
- Direct URL이 IPv6만 반환 → Session Pooler(:5432) 사용

## Key References
- EventBridge: `src/features/space/game/events/` (types.ts + event-bridge.ts)
- Game Manager: `src/features/space/game/internal/game-manager.ts`
- MainScene: `src/features/space/game/internal/scenes/main-scene.ts`
- Avatar: `src/features/space/avatar/internal/` (config, sprite-generator)
- Socket types: `src/features/space/socket/internal/types.ts`
- Socket Bridge: `src/features/space/bridge/internal/use-socket-bridge.ts`
- AssetRegistry: `src/config/asset-registry.ts`
- Auth helpers: `src/lib/auth-helpers.ts`
- Prisma: `prisma/schema.prisma` (13 models)
- Domain rules: `.claude/rules/` (path-based auto-load, 6 files)
- Event protocol: `.claude/reference/event-protocol.md` (human reference)

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
- useState lazy initializer로 localStorage 읽기 (useEffect setState → lint 에러 방지)
