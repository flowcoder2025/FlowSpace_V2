# WI-031-feat 블라인드 적대 검증 — 어드민 대시보드 CSV 내보내기

너는 독립 적대 검증자(codex)다. 아래 WI 구현을 read-only로 검증하고 **반드시 출력 스키마(JSON)에 맞춰** 판정하라. 다른 검증자의 산출물을 참조하지 말라.

## WI 목표
어드민 대시보드 3개 페이지(멤버/로그/analytics)에 클라이언트 측 CSV 내보내기 추가. 순수 CSV 직렬화 헬퍼 + 다운로드.

## 변경 파일 (commit 788ea0e, base = origin/develop 23bf8ab)
- `src/lib/csv.ts` (신규) — 순수 CSV 직렬화: RFC 4180 이스케이프 + 수식 인젝션 중화 + `CSV_BOM`
- `src/components/dashboard/csv-export.ts` (신규) — 도메인 매퍼(membersToCsv/logsToCsv/analyticsToCsv/csvFilename) + `downloadCsv`(DOM)
- `src/components/dashboard/export-csv-button.tsx` (신규) — 공용 버튼
- `src/app/dashboard/spaces/[id]/{members,logs,analytics}/page.tsx` (수정) — 버튼 배선
- `src/lib/csv.test.ts`, `src/components/dashboard/csv-export.test.ts` (신규 테스트 +29)

## 설계 결정(codex consult r1 반영)
- 로그는 cursor 페이징 — 클라가 **로드한 분량만** 내보냄(라벨에 건수 노출). 멤버/analytics는 클라 전량 보유.
- 멤버는 화면 필터된 `visibleMembers`를 내보냄(화면=내보내기 일치).
- CSV 인젝션: 셀 선두 `= + - @` tab CR → `'` prefix(모든 셀 일률, 신뢰 숫자/날짜/enum은 무영향). `-5`/`-홍길동`도 중화(수용된 트레이드오프).
- payload는 `JSON.stringify` 단일 셀, null→빈문자열, 순환참조→`[unserializable]`.
- BOM은 직렬화에 미포함, `downloadCsv`가 Blob 앞에 부착.

## 검증 관점(중점)
1. **CSV/수식 인젝션**: 중화가 RFC4180 이스케이프와 올바른 순서로 결합되는가(prefix 후 quoting)? 우회 가능한 입력은? 멤버 name/email/nickname·로그 payload·user가 사용자 제어 표면.
2. **정확성**: RFC4180 이스케이프(쉼표/따옴표/CRLF/LF), analytics 날짜 union·결측 0·정렬, 이름 폴백, payload null/직렬화실패, 빈 데이터 시 헤더만.
3. **보안/정보위생**: CSV에 민감필드(user.id/image/memberId/spaceId 내부값) 누출 없는가? 응답 정형화 관례(WI-014/019/021) 정합?
4. **경계/캡슐화**: lib(순수) vs dashboard(도메인+DOM) 분리 적절? `internal/*` 직접 import 위반 없는가? 하드코딩(상수 분리)?
5. **다운로드 견고성**: createObjectURL/revoke/앵커 정리, 메모리 누수, 예외 처리.
6. **테스트 품질**: 변이 검출 가능한가(자기참조 오라클·항상참 단언 없는가)? downloadCsv jsdom 스텁 유효?
7. **회귀**: 페이지 기존 동작(필터/로딩/에러) 무손상? tsc/lint/build/test green.

각 이슈는 severity(P0~P3)·location·description·recommendation·defer·deferRationale·fixNow 포함. **fixNow=true는 즉시 수정 필요(P0/P1 또는 명확한 결함)**. 게이트 무관 개선은 defer=true.
