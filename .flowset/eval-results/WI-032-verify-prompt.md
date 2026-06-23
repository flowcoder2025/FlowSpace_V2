# 블라인드 적대 검증 — WI-032-fix

너는 FlowSpace(Next.js 15 풀스택, develop 브랜치) 코드를 read-only로 보는 독립 적대 검증자다.
아래 WI 구현을 **반박 우선(default to skepticism)**으로 검증하고, 결과를 `--output-schema`가 강제하는 JSON으로만 출력하라. 산문 금지. 권위는 마지막 agent_message JSON이다.

## 검증 대상
- 브랜치 `fix/WI-032-fix-log-payload-allowlist`, 구현 커밋 `b3dd931`.
- 변경 파일(diff: `git diff b3dd931~1 b3dd931`):
  - 신규 `src/lib/space-event-log-payload.ts` (+ `.test.ts`)
  - 수정 `src/app/api/spaces/[id]/admin/logs/route.ts` (+ `.test.ts`)
  - 수정 `src/components/dashboard/csv-export.ts`, `event-log-table.tsx`, `src/app/dashboard/spaces/[id]/logs/page.tsx`

## WI 목표 (수용 기준)
어드민 이벤트 로그 `SpaceEventLog.payload`(Json)가 `GET /api/spaces/[id]/admin/logs` → 화면(event-log-table) → CSV(csv-export) 3경로로 raw 직렬화되던 표면을, **API 응답 DTO에서** 키 allowlist로 차단한다(단일 chokepoint — 화면/CSV만 필터하면 raw JSON 직접 호출로 우회). 현재 payload write site 5곳은 operational 메타데이터만 담아 실누출 0이나, 향후 event type이 payload에 민감값(email/inviteCode/accessSecret/prompt) 추가 시 동시 노출되는 회귀 레일을 deny-by-default로 차단(WI-014/019/021/024 동형).

설계 핵심:
1. 순수 모듈 `space-event-log-payload.ts`: `PUBLIC_SPACE_EVENT_PAYLOAD_KEYS`(8키) allowlist + `toPublicSpaceEventPayload`(비객체/배열/null/undefined/빈결과 → null) + `toPublicSpaceEventLog` lean DTO(spaceId/userId/guestSessionId/participantId 등 내부 스칼라 제외, 소비처가 쓰는 {id,eventType,payload,createdAt,user}만).
2. logs route가 `buildCursorPage` 후 `items.map(toPublicSpaceEventLog)`로 정규화, `{logs,nextCursor}` 계약 보존.
3. 화면/CSV/페이지는 payload 타입만 공유 `PublicSpaceEventPayload`로 단일화(런타임 무변경 — 정규화는 API 담당, 이중 책임 회피). `import type`만 사용해 client-safe.

## 반드시 적대적으로 확인할 것
1. **8키 allowlist 완전성·정확성**: 실제 5개 write site(livekit/webhook:147,166 / admin/announce:59 / admin/members:158,198 / admin/messages:53)에서 쓰는 payload 키가 allowlist에 전부 있는가? 빠진 키가 있으면 화면/CSV Details가 빈값으로 회귀한다. 반대로 불필요/위험한 키가 등재됐는가?
2. **chokepoint가 정말 API인가**: 화면/CSV가 추가 sanitize 없이 정규화된 데이터에 의존하는데, payload가 logs API 외 다른 출처로 이 컴포넌트에 들어올 경로가 있는가(우회)? logs/page.tsx 데이터 흐름 확인.
3. **lean DTO 무회귀**: spaceId/userId/guestSessionId/participantId 제거가 실제 소비처(event-log-table/logs page/csv-export)를 깨지 않는가? 응답 계약 변경이 기존 테스트/클라를 깨는가?
4. **빈 결과 → null 정책**: allowlist 키 0개일 때 null 반환이 화면 "-"·CSV "" 계약과 일관한가? `{}` 대신 null이 맞는가?
5. **client-safe**: `import type { Prisma }`가 런타임 elide되는가? 클라이언트 번들에 @prisma/client가 끌려오지 않는가(build 통과했으나 구조적 확인)?
6. **타입 안전성**: `toPublicSpaceEventLog`가 route findMany 행(여분 필드 포함)을 구조적으로 수용하는가? `eventType: SpaceEventType` → `string` 할당 안전?
7. **테스트 오라클 강도**: 테스트가 가드를 실제로 검증하는가, 아니면 false-pass(가드 무력화해도 통과)인가? 변이검증 관점.

## 출력
스키마(reviewer=codex, scores/weightedTotal=null) 준수. verdict=PASS|WARNING|FAIL. issues는 P0~P3 + defer/deferRationale/fixNow. 결함 없으면 issues 빈 배열 + PASS. 사소한 즉시수정 권고는 fixNow=true로 표시.
기계게이트는 이미 통과(tsc0/lint0err[선재 LiveKit 경고1 WI무관]/vitest 364→380/build0) — 코드 정확성·설계·누락·회귀에 집중.
