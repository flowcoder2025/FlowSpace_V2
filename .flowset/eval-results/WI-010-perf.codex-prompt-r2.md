[블라인드 적대 검증 — WI-010-perf, P3, ROUND 2]

리뷰어=codex. 마지막 메시지로 review 스키마(평탄화본) JSON만 출력하라. `scores`/`weightedTotal`은 null. issues는 P0~P3 + defer/deferRationale/fixNow. 권위는 최종 JSON.

대상: 브랜치 `perf/WI-010-perf-spaces-pagination`의 develop 대비 전체 변경. `git diff develop...HEAD` 또는 `git diff 78055ab HEAD`로 확인하라. 커밋 2개(ce57d35 구현 + 529108e 수정).

[r1 지적 → 수정 내역]
r1에서 P2/fixNow로 "필터 변경이 진행 중 loadMore를 무효화하면 stale loadMore의 finally가 _reqId 불일치로 isLoadingMore 리셋을 건너뛰고, fetchSpaces는 isLoadingMore를 건드리지 않아 isLoadingMore가 true로 고착 → 새 필터에서 hasMore여도 '더 보기' 버튼이 영구 비활성"을 지적했다.
→ 수정(커밋 529108e): `fetchSpaces` 시작 시 `set({ isLoading: true, isLoadingMore: false, _reqId })`로 isLoadingMore를 선제 해제(리로드/필터 변경은 진행 중 loadMore를 대체). 회귀 테스트(`space-store.test.ts` race 케이스)를 교체 필터 응답 `hasMore:true`로 두고 `isLoadingMore===false` 단언 추가. 변이 검증 완료(수정 제거 시 race 테스트 FAIL 재현).

[검증 관점]
1. r1 지적(isLoadingMore 고착)이 실제로 해소됐는가? 새 회귀 테스트가 그 결함을 실제로 잡는가?
2. fetchSpaces의 isLoadingMore 선제 해제가 새로운 경쟁/회귀(예: 정상 loadMore 중 isLoadingMore 조기 해제, fetchSpaces/loadMore 단일 _reqId 공유의 다른 누수)를 만들지 않는가?
3. cursor 페이지네이션 정확성·정렬 안정성·보안(scope가 cursor보다 우선)·하위호환은 r1 관점 그대로 여전히 유효한가?
4. 도메인 rules(app.md/data-ownership/모듈 경계·캡슐화·하드코딩) 위반이 없는가?

P0/P1 또는 fixNow:true가 있으면 명시하라. 없으면 P2/P3 분류 + defer/근거를 채워라.
