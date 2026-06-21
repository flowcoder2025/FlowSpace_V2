# 재검증(r2) — WI-011-test (FlowSpace)

독립 검증자(codex). r1에서 당신이 P3로 지적한 3건을 메인이 선제 강화했다. **git diff(`develop..HEAD`)만 ground truth로** 재검토하고 스키마(`--output-schema`) JSON만 반환하라. 파일 수정 금지.

## r1 지적 → r2 조치 (재확인 대상)
1. **mountedRef 가드 smoke false-pass** (r1: `useScreenRecorder.test.ts`): React 19에서 'unmount 후 setState'는 관측 불가하므로, 가드가 차단하는 `showNotification`의 `setTimeout(_, notificationDuration)`을 고유 delay(123456)로 식별하도록 변경. 가드 무력화(`if(false)`) 시 해당 setTimeout이 예약되어 테스트 FAIL — 메인이 변이검증 실증. 이제 false-pass인가?
2. **filter 매트릭스 불완전** (r1: superAdmin owned/joined 정확 scope 미검증): `filter=owned + 슈퍼어드민 → { ownerId, status:ACTIVE }`, `filter=joined + 슈퍼어드민 → { members.some.userId, status:ACTIVE }` 정확 scope 케이스 추가. 전역화 회귀를 잡는가?
3. **응답 allowlist 부분적** (r1: templateId/updatedAt 누출 시 통과): `Object.keys(space).sort()` 정확 key 집합 단언으로 변경 + templateId/updatedAt 포함 명시 부재 확인. 추가 필드 누출을 잡는가?

## 현재 상태
- 변경 파일: `src/__tests__/helpers/api-route.ts`(신규), `src/app/api/spaces/route.test.ts`(신규), `src/features/space/hooks/internal/useScreenRecorder.test.ts`(수정). 소스 코드(route.ts/useScreenRecorder.ts)는 여전히 무수정.
- 기계 게이트: tsc 0 · lint 0 · vitest 128/128(직전 126→128) · build 0.

## 산출
- 스키마(WI-011-codex-schema.json) JSON만. reviewer="codex", schemaVersion=1, scores=null, weightedTotal=null.
- r1 3건이 해소됐는지 명시(해소면 issues에서 제외). 새/잔여 실결함만 보고. P0/P1·fixNow 있으면 게이트 미통과.
