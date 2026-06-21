[블라인드 적대 검증 — WI-010-perf, P3, ROUND 3]

리뷰어=codex. 마지막 메시지로 review 스키마(평탄화본) JSON만 출력하라. `scores`/`weightedTotal`은 null. issues는 P0~P3 + defer/deferRationale/fixNow. 권위는 최종 JSON.

대상: 브랜치 `perf/WI-010-perf-spaces-pagination`의 develop 대비 전체 변경. `git diff develop...HEAD` 또는 `git diff 78055ab HEAD`로 확인하라. 커밋 3개(ce57d35 구현 + 529108e isLoadingMore 고착 수정 + ed73930 loadMore isLoading 가드).

[r2 지적 → 처리]
- r2 P3(`space-store loadMore` 역방향 누수: 리로드 중 loadMore가 _reqId를 올려 리로드 무효화·isLoading 고착): 수정(ed73930) — loadMore 가드에 `isLoading` 추가(`if (isLoading || !hasMore || !nextCursor || isLoadingMore) return`). 회귀 테스트 추가(fetchSpaces in-flight 중 loadMore 호출 → no-op + isLoading 고착 없음 단언).
- r2 P3(`schema.prisma` 복합 인덱스 부재 → 쿼리플랜 스케일): DB 마이그레이션 승인 + 프로덕션 쿼리플랜 검증이 필요한 별개 범위로 판단, **후속 WI로 defer**. WI-010은 응답 크기/cursor 정확성 경계가 목표.

[검증 관점]
1. r2 역방향 누수가 실제로 해소됐는가? 새 가드가 정상 loadMore(리로드 아님)를 막지 않는가? 새 회귀 테스트가 유효한가?
2. cursor 페이지네이션 정확성·정렬 안정성·보안(scope 우선)·하위호환은 여전히 유효한가?
3. 남은 결함이 있는가? 인덱스 P3 defer가 타당한가(코드 패치 범위 밖)?
4. 도메인 rules 위반이 없는가?

P0/P1 또는 fixNow:true가 있으면 명시하라. 없으면 P2/P3 분류 + defer/근거를 채워라.
