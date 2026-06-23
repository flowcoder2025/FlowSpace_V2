# 블라인드 적대 검증 r2 — WI-032-fix (P2 해소 확인)

너는 FlowSpace를 read-only로 보는 독립 적대 검증자다. r1에서 네가 P2(fixNow)로 적출한 결함의 해소와 전체 변경을 재검증하라. `--output-schema` JSON만 출력(reviewer=codex, scores/weightedTotal=null).

## r1 적출 (P2/fixNow)
`GET /api/spaces/[id]/admin/stats`의 `recentActivity`가 raw `prisma.spaceEventLog.findMany`(payload + 내부 스칼라)를 정규화 없이 반환 → WI-032가 닫으려는 회귀 레일의 병렬 경로(화면/CSV 외 또 다른 누출면). regression test 권고.

## r2 해소 (커밋 `b6e3811`)
- `src/app/api/spaces/[id]/admin/stats/route.ts`: `recentActivity.map(toPublicSpaceEventLog)` 적용(logs route와 동일 정규화). 오버뷰 페이지(`dashboard/spaces/[id]/page.tsx`)는 payload 미렌더·내부 스칼라 미사용 → 무회귀.
- `page.tsx`: recentActivity payload 타입을 공유 `PublicSpaceEventPayload`로 단일화.
- 신규 `stats/route.test.ts` (+4): payload allowlist만·lean DTO·권한(401/403)·카운트 무회귀.
- logs route 주석 "단일 chokepoint" → "응답 DTO 계층(logs+stats 공통)" 정정.
- 전수 grep: SpaceEventLog 행을 클라에 반환하는 read 경로는 `admin/logs` + `admin/stats` 둘뿐(나머지 4개는 write site).

## 재검증 지시
- `git diff b3dd931 b6e3811`로 r2 변경 확인. `git diff b6e3811~2 b6e3811`로 전체 WI 확인.
- (1) stats recentActivity가 이제 allowlist+lean DTO로 정규화되는가? (2) 내가 놓친 **제3의 SpaceEventLog 클라 반환 경로**가 있는가(전수 재확인)? (3) stats 정규화가 오버뷰 페이지를 깨는가? (4) r1 본문(logs route allowlist·lean DTO·client-safe·테스트 오라클)에 잔여 결함이 있는가?
- 기계게이트 통과(tsc0/lint0err[선재 LiveKit 경고1]/vitest 364→384/build0).
- verdict=PASS|WARNING|FAIL + issues(P0~P3, defer/fixNow). 결함 없으면 빈 issues + PASS.
