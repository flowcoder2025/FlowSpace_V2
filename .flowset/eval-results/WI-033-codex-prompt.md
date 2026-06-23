# 블라인드 코드 검증 — WI-033-feat (어드민 대시보드 한글화 + copy constants 분리)

당신은 독립 코드 검증자입니다. FlowSpace(Next.js 15 + Phaser 3) 저장소에서 read-only로 동작합니다. **파일을 수정하지 마세요.** 출력은 강제된 JSON 스키마 객체 하나만 반환합니다(산문 금지).

## Ground truth (이것만 근거로)
- ACTIVE WI: `.flowset/current.json` (WI-033-feat).
- 변경 디프: `git diff c4c7427 HEAD -- src/` (base develop=`c4c7427`, impl=HEAD=`77f77e6`). 이 디프와 현재 트리 소스만 검증 대상.
- 설계 협의 합의: `.flowset/eval-results/WI-033-consult-out.txt` (참고용 — codex 설계 협의 결과).

## WI 목표 / 수용 기준
1. 어드민 대시보드(`src/app/dashboard/**` + `src/components/dashboard/**`)의 사용자 노출 영문 문자열을 단일 SoT `src/constants/dashboard-copy.ts`(`DASHBOARD_COPY`, 키 영문/값 한글, `as const`)로 분리·한글화. 하드코딩 금지(rules/app.md #9).
2. **표시 라벨과 도메인/API 값 분리(핵심)**: `<option value="...">`·필터 키·API payload·CSS 색상 맵(EVENT_COLORS/ROLE_COLORS/RESTRICTION_COLORS) 키 같은 **enum/도메인 값은 절대 변경하지 않는다**. 표시 라벨만 한글화. enum 코드는 `DASHBOARD_COPY.roleLabel/restrictionLabel/messageTypeLabel/eventTypeLabel/accessTypeLabel` 헬퍼로 표시만 매핑(미정의 코드는 코드로 폴백).
3. 동적/보간 문자열은 함수 엔트리(`MEMBERS.count`, `MEDIA.grantsTitle`, `LOGS.csvLabel`).
4. CSV(csv-export.ts) 헤더 + 표시 값(role/restriction/eventType/guest/unknown)은 화면과 동일 한글 라벨 공유. payload JSON 키는 데이터라 미번역.
5. 무회귀: 기능 동작·필터·API 계약·페이지네이션·CSV 구조(이스케이프/BOM/순서) 불변.

## 검증 관점 (특히 집중)
- **회귀 위험 #1 — 값/라벨 혼동**: 한글화 과정에서 `<option value>`나 필터/액션 토큰("mute"/"unmute"/"kick"/"ban"/"role:STAFF"/"role:PARTICIPANT"·"ALL"/"OWNER"/"STAFF"/"PARTICIPANT"·"PUBLIC"/"PRIVATE"/"PASSWORD") 또는 색상 맵 키가 한글로 바뀌어 API/필터/스타일이 깨지지 않았는지. handleAction(member-table) 분기 로직이 보존됐는지.
- **무회귀**: 디프가 순수 문자열 치환인지, 동작/제어흐름을 바꿨는지. 특히 media-management.tsx의 Guest 폴백 체인, members 멤버 수 표시, member-table name 폴백.
- **CSV**: 헤더/값 한글화가 csv.ts 이스케이프·수식 인젝션 중화·CRLF·BOM·날짜 union 정렬을 깨지 않는지. "관리자 작업"/"이벤트 유형" 같은 공백 포함 라벨이 의도치 않게 따옴표로 감싸지지 않는지(quoting 트리거는 `, " CR LF`만).
- **누락**: 대시보드 범위에 한글화 안 된 잔여 영문 사용자 노출 문자열이 있는지(enum 코드·색상 키·route 세그먼트 제외).
- **라벨 폴백 안전성**: `*Label()`이 미정의 enum 코드를 빈 칸/undefined가 아니라 코드로 폴백하는지.
- **테스트 정합**: 변경된 테스트 단언이 새 한글 출력과 정확히 일치하는지, 단언이 약화(가드 상실)되지 않았는지.
- **scope**: 변경이 대시보드로 한정됐는지(인-스페이스/API 라우트/비대시보드 회귀 없는지).

## 분류
- P0 차단 / P1 심각 / P2 보통 / P3 경미. `fixNow`=즉시 수정 필요(P0/P1급 또는 사소해도 지금 고쳐야). `defer`=후속 가능(사유 명시).
- 이 WI는 UI 문자열 한글화이므로 보안/데이터 경계 변경은 없어야 함 — 만약 발견하면 보고.
- 산출: review.schema.json 변형(scores=null, weightedTotal=null). reviewer="codex".
