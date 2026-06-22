# WI-031-feat 설계 협의 (r1) — 어드민 대시보드 CSV 내보내기

너는 FlowSpace(Next.js 15 + Phaser 3 메타버스) 코드베이스의 설계 협의자다. 산문으로 답하라.
**마지막에 "내가 놓칠 위험 1가지"를 반드시 지적하라.**

## 목표
어드민 대시보드 3개 페이지에 CSV 내보내기 추가:
- **멤버** `/dashboard/spaces/[id]/members` — 클라가 전체 멤버를 한 번에 보유(페이지네이션 없음)
- **로그** `/dashboard/spaces/[id]/logs` — **cursor 페이지네이션**, 클라는 "더 보기"로 로드된 페이지들만 state 보유
- **analytics** `/dashboard/spaces/[id]/analytics` — 일별 메시지/방문자 2개 시계열 전체 보유

요구사항(원장): "클라 측 CSV 생성. 순수 CSV 직렬화 헬퍼 + 다운로드."

## 데이터 형태(실측)
- Member: `{ id, role: OWNER|STAFF|PARTICIPANT, restriction: NONE|MUTED|BANNED, displayName: string|null, user?: {id,name,email,image}|null, guestSession?: {id,nickname}|null, createdAt: string(ISO) }`
- LogEntry: `{ id, eventType: string, payload?: Record<string,unknown>|null, createdAt: string(ISO), user?: {name,email}|null }`
- AnalyticsData: `{ dailyMessages: {date:string,count:number}[], dailyVisitors: {date:string,count:number}[] }` (date = YYYY-MM-DD, 두 시계열의 날짜 집합이 다를 수 있음 — sparse)

## 코드베이스 관례(실측)
- 모듈 경계: `module/index.ts`(공개) + `internal/`(비공개). 순수 cross-cutting 헬퍼는 `src/lib/`(예: `pagination.ts`, `query-filter.ts`). 대시보드 전용 클라 헬퍼는 `src/components/dashboard/`(예: `date-range.ts`).
- 다운로드 기존 패턴(useScreenRecorder): `URL.createObjectURL(blob)` → `document.createElement("a")` → `a.download` → `a.click()` → `revokeObjectURL`.
- vitest: jsdom 환경, `src/**/*.test.{ts,tsx}`. **jsdom은 `URL.createObjectURL` 미구현**(스텁 필요).
- 하드코딩 금지(상수 분리), UTF-8, 응답 정형화 관례 강함(WI-014/019/021 — 민감필드 미노출).

## 내 제안 설계
1. **`src/lib/csv.ts`**(순수, DOM 무의존, vitest 커버): `toCsv(headers: string[], rows: string[][]): string`
   - RFC 4180 이스케이프(셀에 `,`/`"`/`\n`/`\r` 포함 시 큰따옴표 감싸고 내부 `"`→`""`), 줄바꿈 CRLF.
   - **CSV/수식 인젝션 중화**: 셀이 `= + - @` (또는 탭/CR)로 시작하면 앞에 `'` 붙임(OWASP, Excel/Sheets). 멤버 name/email/nickname, 로그 payload(JSON)·user가 사용자 제어 표면.
   - `CSV_BOM = "﻿"` 상수(Excel 한글 깨짐 방지).
2. **`src/components/dashboard/csv-export.ts`**(클라):
   - 순수 도메인 매퍼(테스트 가능): `membersToCsv(members)`, `logsToCsv(logs)`, `analyticsToCsv(data)` — analytics는 두 시계열을 날짜 union으로 머지(`date, messages, visitors`).
   - `downloadCsv(filename, csv)`: BOM+`text/csv;charset=utf-8` Blob → 앵커 클릭(useScreenRecorder 패턴). 유일한 비순수부.
   - 컬럼: 멤버=name,email,role,restriction,joined(ISO),isGuest / 로그=time(ISO),eventType,user,details(payload JSON) / analytics=date,messages,visitors.
3. 각 페이지 헤더에 "CSV 내보내기" 버튼 → 현재 state로 CSV 생성 후 downloadCsv. 파일명 `flowspace-<type>-<spaceId>-<오늘날짜>.csv`.

## 협의 질문
Q1. **로그 페이지네이션**: 로그는 cursor 페이징이라 클라엔 로드된 페이지만 있음. 두 옵션 — (a) **로드된 N건만 내보내기**(버튼 라벨에 건수 명시, 스코프 타이트, 멤버/analytics는 이미 전량) vs (b) **cursor 루프로 전량 fetch 후 내보내기**(완전하나 API 반복호출·스코프 확대). 원장은 "클라 측 생성". 어느 쪽? (b)면 안전장치(상한·로딩 UX)는?
Q2. **모듈 경계**: 순수 직렬화=`lib/csv.ts`, 도메인 매퍼+다운로드=`dashboard/csv-export.ts` 분리가 관례에 맞나? 매퍼도 lib로? 더 단순한 구조?
Q3. **CSV 인젝션 중화 정책**: `'` prefix가 적절한가, 아니면 다른 방식(공백 prefix, 큰따옴표 강제)? `-` prefix 중화가 음수("-5")를 망가뜨리는 부작용은? analytics count는 숫자라 무관하나 로그/멤버 텍스트엔 `-`로 시작하는 정상값 가능 — 트레이드오프 판단.
Q4. **테스트 전략**: 순수 매퍼/직렬화는 DOM 없이 vitest. `downloadCsv`는 jsdom `createObjectURL` 스텁으로 테스트할 가치가 있나, 아니면 순수부만 커버?
Q5. payload(JSON) 직렬화 — `JSON.stringify`로 한 셀에 넣으면 CSV 셀 안에 따옴표/줄바꿈 많음(이스케이프로 처리 가능). 그대로 둘지, 평탄화할지?

간결하게, 결정 위주로.
