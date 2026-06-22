# WI-031-feat 블라인드 적대 검증 r3 — CSV 내보내기 (r2 P2 LF 해소 후)

너는 독립 적대 검증자(codex)다. read-only로 검증하고 **출력 스키마(JSON)에 맞춰** 판정하라.

## r2 → r3 변경 (HEAD = 056ce56)
r2(FAIL, fixNow P2×1=선두 LF 미중화) 대응 완료:
- **P2 해소**: `src/lib/csv.ts` `FORMULA_INJECTION_PREFIXES`에 `"\n"` 추가(기존 `= + - @ \t \r`에 LF 합류 — `\t`/`\r`만 있고 `\n` 빠진 비대칭 해소). 회귀 테스트 추가: `toCsv(["x"],[["\n=SUM(1)"]])` → `x\r\n"'\n=SUM(1)"`(prefix 후 LF 포함이라 따옴표로 감쌈).
- 직전 r2에서 합의된 처분 유지: P2-A(payload Details)=defer(화면 event-log-table가 이미 raw payload 렌더·admin-scoped·비밀 아님), P2-B(이름 폴백)·P3-C(downloadCsv finally) 해소.

## 검증 대상
`src/lib/csv.ts`(인젝션 prefix 집합 변경), `src/lib/csv.test.ts`(회귀). 그 외 WI-031 파일 전체.

## 확인 요청
1. LF 추가가 인젝션 중화를 완성하는가(선두 공백류 `\t \r \n` 대칭)? neutralize→quote 순서 유지?
2. 남은 fixNow(P0/P1/미해소 P2) 있는가?
3. 회귀(RFC4180·analytics·이름 폴백·경계·민감필드) 없는가?

게이트는 로컬 green(tsc0/lint0err/vitest 364/build0). 남은 개선은 defer=true.
