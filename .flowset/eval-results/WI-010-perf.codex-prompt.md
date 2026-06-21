[블라인드 적대 검증 — WI-010-perf, P3]

리뷰어=codex. 아래 변경을 read-only로 독립 검증하고, 마지막 메시지로 review 스키마(평탄화본) 형식 JSON만 출력하라. `scores`/`weightedTotal`은 null. `issues`는 P0~P3, 각 항목에 `defer`/`deferRationale`/`fixNow` 포함. 권위는 최종 JSON.

대상 커밋: HEAD. `git show HEAD` 또는 `git diff HEAD~1 HEAD`로 변경을 직접 확인하라.

변경 파일:
- src/lib/pagination.ts (신규 순수 헬퍼)
- src/lib/pagination.test.ts (신규 테스트)
- src/app/api/spaces/route.ts (GET 페이지네이션)
- src/stores/space-store.ts (loadMore + race 가드)
- src/stores/space-store.test.ts (신규 테스트)
- src/components/spaces/space-list-view.tsx ("더 보기" 버튼)

[해결 대상 결함]
`GET /api/spaces`가 페이지네이션 없이 `findMany`로 전체 ACTIVE 스페이스를 로드했다. WI-009에서 슈퍼어드민이 `filter` 없이/`?filter=all` 호출 시 전역(`scope={}`, 모든 ACTIVE)을 받도록 해, 스페이스 수가 늘면 응답이 무한정 커지는 스케일 부채(P3)였다.

[수정 요지]
1. cursor 페이지네이션: `limit`(기본 50·최대 100, `parsePageLimit`로 NaN/0/음수/초과 정규화) + `cursor`(직전 페이지 마지막 id). `take: limit+1` 후 `buildCursorPage`로 잘라 `hasMore`/`nextCursor` 도출. 응답 `{ spaces, nextCursor, hasMore }` — 기존 `spaces` 필드 유지(하위호환).
2. 정렬 안정성: `orderBy: [{ updatedAt: "desc" }, { id: "desc" }]`. updatedAt이 가변·비유니크라 id 타이브레이커로 동일 시각 내 결정적 cursor 순서 보장(`cursor: { id }`, `skip: 1`).
3. 모든 스코프(owned/joined/all/전역)에 일관 적용.
4. 클라이언트: `space-store`에 `nextCursor`/`hasMore`/`isLoadingMore`/`loadMore` 추가. `_reqId` 요청 토큰으로 필터 변경/연속 클릭 중 늦게 도착한 stale 응답을 무시(이전 필터 페이지가 새 목록에 append되는 경쟁 상태 차단). `space-list-view`에 `hasMore` 시 "더 보기" 버튼(슈퍼어드민 전역 가시성 회귀 방지).

[검증 관점]
1. cursor 페이지네이션 정확성: 경계(limit·limit+1·빈 결과)에서 누락/중복/off-by-one이 없는가? `buildCursorPage`의 hasMore/nextCursor 도출이 옳은가?
2. 정렬 안정성: updatedAt(가변) 기반 cursor의 한계가 적절히 처리됐는가? id 타이브레이커 + `cursor:{id}`가 Prisma에서 유효한가(id는 PK=유니크)?
3. 보안/인가: 페이지네이션 추가가 WI-009의 scope 분기(일반 사용자=멤버십, 슈퍼어드민=전역)나 인증 가드를 약화시키지 않는가? cursor로 권한 밖 스페이스가 노출되지 않는가(where scope가 cursor보다 우선 적용되는가)?
4. 하위호환: 기존 유일 소비자(space-store fetchSpaces가 data.spaces 읽음)와 응답 계약이 깨지지 않는가?
5. 경쟁 상태 가드: `_reqId` 토큰 방식이 실제로 stale 응답(필터 변경 중 도착)을 차단하는가? isLoading/isLoadingMore의 finally 리셋이 새 요청 상태를 덮어쓰지 않는가?
6. 신규 테스트가 결함/경쟁 상태를 실제로 잡는가(가짜 PASS 아닌가)?
7. 도메인 rules(app.md: select/include 명시·세션 userId 강제·에러 형식 / data-ownership / 모듈 경계·캡슐화·하드코딩 금지) 위반이 없는가?

P0/P1 또는 fixNow:true가 있으면 반드시 명시하라. 없으면 P2/P3로 분류하고 defer 여부와 근거(deferRationale)를 채워라. 내가 놓친 위험이 있으면 지적하라.
