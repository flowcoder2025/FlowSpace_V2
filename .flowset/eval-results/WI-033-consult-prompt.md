# 설계 협의 요청 — WI-033 (어드민 대시보드 한글화 + copy constants 분리)

당신은 FlowSpace(Next.js 15 + Phaser 3 메타버스, 한국어 단일 언어 제품)의 설계 협의 파트너입니다. 메인 구현은 Claude가 합니다. 이 협의는 **구현 착수 전 설계 결정**을 좁히기 위함입니다. read-only 입니다.

## 배경 / 실측
- 사용자 요청: 어드민 대시보드가 100% 영문이라 제품(한국어)과 불일치. 한글화 + 하드코딩 제거.
- 제품에 **i18n 라이브러리 미도입**(next-intl 류 없음, 단일 한국어). → i18n 프레임워크 도입은 과함. 단순 한글화 + 상수 분리로 결정(fix_plan 확정).
- 프로젝트 규칙(CLAUDE.md / .claude/rules/app.md #9): **하드코딩 금지 — UI 문자열 상수는 `constants/`로 분리.**
- 기존 상수 컨벤션: `src/constants/navigation.ts`, `src/constants/game-constants.ts` (flat 파일 + named export, `@/constants/<name>` import, 도메인별 객체/상수, 한국어 주석).
- 모듈 경계 규칙: `module/index.ts` + `module/internal/` 캡슐화 (단, `src/constants/`는 공용 상수 디렉토리로 이미 flat 운용 중).

## 실측 인벤토리 (Explore 전수)
- 범위: `src/app/dashboard/**`(8 소스파일) + `src/components/dashboard/**`(10 소스파일, .test 제외). 총 18 소스파일, **사용자 노출 영문 문자열 ~98개**.
- 카테고리: 페이지 제목/헤딩, 테이블 헤더(약 20), 버튼 라벨(약 13), 폼 라벨(약 8), `<select>` 옵션 라벨(약 22), 상태/배지 라벨(약 11), 로딩/빈상태 메시지(약 10), CSV 헤더(10), 에러 메시지(setError "Failed to load media data" 등), placeholder/aria-label/title 속성.
- **이미 한글 혼재**: announce-form("공지 발송"), members 빈상태("멤버가 없습니다."), logs CSV 버튼(`CSV 내보내기 (로드된 N건)`), export-csv-button aria-label("CSV 내보내기"). → 일관성 회복 필요.
- **동적/보간 문자열 3종**:
  - members/page.tsx: `{visible}{visible !== total ? ` / ${total}` : ""} members` (멤버 수)
  - media-management.tsx: `Spotlight Grants ({grants.length})` (헤딩 + 개수)
  - (logs CSV 버튼은 이미 한글 보간)
- **날짜 구분자** `"~"` (messages/logs 페이지): 비영문, 그대로 유지 후보.
- CSV 헤더(csv-export.ts MEMBER_HEADERS/LOG_HEADERS/ANALYTICS_HEADERS, "Yes"/"No", "[unserializable]")는 다운로드 CSV(Excel)에 노출 → 사용자 노출.

## 내 제안 (검토·수정 요청)
1. **배치/구조**: 신규 단일 파일 `src/constants/dashboard-copy.ts` — 기존 flat `src/constants/` 컨벤션 일치. 기능 영역별 중첩 객체(`NAV`, `OVERVIEW`, `MEMBERS`, `MESSAGES`, `LOGS`, `MEDIA`, `ANALYTICS`, `SETTINGS`, `COMMON`)로 그룹. **키는 영문(문자열 식별성 유지), 값은 한국어.** `as const`. 동적 문자열은 함수 엔트리(`memberCount: (visible, total) => ...`).
   - 대안 A: 컴포넌트별 co-locate 상수. 대안 B: `src/components/dashboard/constants/`. → 나는 단일 `src/constants/dashboard-copy.ts` 선호(SoT 단일, 재사용 라벨[테이블 헤더↔CSV 헤더] 공유 용이).
2. **scope 경계**: **dashboard로 엄격 고정**(`app/dashboard/**` + `components/dashboard/**`). fix_plan Notes가 player-list.tsx "No other players" 등 인-스페이스 산재 영문도 언급하나, **범위 비대 위험**이 명시됨 → 인-스페이스/API 에러메시지는 **별도 후속 WI로 분리**(이번엔 손대지 않음). 동의?
3. **포함 범위**: CSV 헤더("Name","Email","Role","Restriction","Guest","Joined","Time","Event Type","Details","Date","Messages","Visitors","Yes","No"), setError 에러 메시지, `<select>` 옵션 라벨, placeholder/aria-label/title 전부 한글화 포함. 동의? (CSV 헤더 한글화 시 Excel 다운로드 영향 — 한글 제품이므로 한글 헤더가 옳다고 판단)
4. **무회귀 주의**: `<select>` 옵션의 `value`(OWNER/STAFF/ALL/날짜범위 등 API/필터 키)는 **절대 미변경**, 보이는 라벨만 한글화. 동적 컴포넌트 prop(차트 title 등)도 라벨만.
5. **테스트**: 기존 dashboard 테스트(members/page.test.tsx, logs/page.test.tsx, messages/page.test.tsx, csv-export.test.ts 등)가 영문 문자열을 단언하는지 — 단언하면 한글로 갱신 필요. 신규 상수 모듈 자체 테스트는 가치 낮음(순수 데이터)이나, 동적 함수 엔트리(memberCount 등)는 단위 테스트 권장.

## 질문
- Q1. 배치/구조(제안 1) — 단일 `dashboard-copy.ts` vs 대안, 중첩 객체 그룹핑이 적절한가? 키 영문/값 한글이 맞나?
- Q2. scope 경계(제안 2) — dashboard 엄격 고정 + 인-스페이스 분리가 옳은가? player-list를 이번에 포함해야 할 강한 이유가 있나?
- Q3. CSV 헤더/에러메시지 포함(제안 3) — 동의하나, 보류할 게 있나?
- Q4. 동적/보간 문자열을 함수 엔트리로 두는 설계가 적절한가? 더 나은 패턴?
- Q5. **내가 놓치고 있는 위험 1가지** (가장 중요) — 한글화/상수 분리에서 회귀나 함정이 될 만한 것.

산문으로, 결정 가능한 구체적 권고로 답해 주세요.
