# 설계 협의 요청 — WI-011-test (FlowSpace, Next.js 15 + Vitest)

당신은 독립 설계 파트너입니다. 메인 구현자는 Claude. read-only로 코드베이스를 확인하고 아래 설계 결정에 대해 의견과 "내가 놓칠 위험 1가지"를 산문으로 주세요. **코드를 바꾸지 마세요.**

## 배경
P3 테스트 부채 해소. 두 영역:
1. `GET /api/spaces` filter 분기 회귀 테스트 + 재사용 가능한 **API 라우트 테스트 하니스**(auth/prisma mock) 신규 도입.
2. `useScreenRecorder`의 unmount-during-stopping **settle 경로** 테스트(WI-006 evaluator P3 흡수 — 기존 테스트는 onerror 경로만 커버, 언마운트 cleanup이 `pendingStopResolveRef`를 settle하는 경로 미커버).

대상 파일:
- `src/app/api/spaces/route.ts` (GET 핸들러: `auth()` + `prisma.space.findMany`, filter→scope 분기, cursor 페이지네이션)
- `src/features/space/hooks/internal/useScreenRecorder.ts` (cleanup effect line 166~205, stopRecording line 349~413)
- 기존 테스트: `src/features/space/hooks/internal/useScreenRecorder.test.ts` (onerror 경로 4건), `src/lib/pagination.test.ts`, `src/stores/space-store.test.ts`, `src/__tests__/module-boundaries.test.ts`
- vitest 설정: `vitest.config.ts` (environment jsdom, include `src/**/*.test.ts(x)`, alias `@`→src)

## 검증된 PoC (이미 통과)
`vi.hoisted`로 `mockAuth`/`mockPrisma` 생성 → `vi.mock("@/lib/auth")`/`vi.mock("@/lib/prisma")` → `import { GET } from "./route"` → `new NextRequest(new URL(...))`로 호출 → `res.status` / `await res.json()` 읽기 + `mockPrisma.space.findMany.mock.calls[0][0].where`로 scope 캡처. 401·슈퍼어드민 전역 scope `{status:"ACTIVE"}` 2케이스 통과 확인.

## 결정 1 — 하니스 형태
vitest의 `vi.mock`/`vi.hoisted`는 **파일 로컬 호이스팅**이라 mock wiring 자체는 테스트 파일마다 6줄 정도 반복이 불가피. 내 계획:
- `src/__tests__/helpers/api-route.ts` (비-test 파일, vitest include 미수집)에 **순수 빌더만** 노출: `buildGetRequest(path, params)` → NextRequest, `makeSession(user|null)`, `makeSpaceRow(overrides)` (route의 include 형태 `{template, _count, members}` 맞춘 행), `readJson(res)`.
- `vi.mock` 프리앰블은 테스트 파일에 그대로 두되 헬퍼 파일 상단 주석에 복붙용 패턴 명시.

질문: (a) 이 분리가 맞나, 아니면 `__mocks__/` 디렉토리 자동목 또는 `setupFiles`로 auth/prisma mock을 중앙화하는 게 나은가? 후자는 모든 테스트에 전역 영향 → 과하다고 판단했는데 동의하는가? (b) 헬퍼를 `src/__tests__/helpers/`에 두는 게 `module-boundaries.test.ts`(cross-module internal import 차단) 게이트와 충돌 없나?

## 결정 2 — filter 분기 커버리지
회귀 가치 높은 순으로 커버 예정:
1. 미인증 → 401
2. `filter=owned` → `where.ownerId === userId`
3. `filter=joined` → `where.members.some.userId === userId`
4. `filter=null` + 일반 사용자 → 멤버십 scope
5. `filter=null` + 슈퍼어드민 → 전역(`where`에 ownerId/members 없음, `status:"ACTIVE"`만)
6. `filter=all` + 일반 사용자 → **멤버십 scope**(전역 아님 — 권한 격리 핵심)
7. `filter=all` + 슈퍼어드민 → 전역
8. 미허용 filter(`?filter=bogus`) → 400 `code:"INVALID_FILTER"`
9. 페이지네이션: `?limit`/`?cursor` → `take===limit+1`, `cursor:{id}`+`skip:1` 전달, 응답 `{spaces,nextCursor,hasMore}` 형태(`limit+1`개 반환 시 hasMore=true·마지막 잘림)
10. 보안: 위조 cursor가 scope를 우회하지 못함(`where:{...scope,status}`가 cursor와 독립 — findMany 인자에 scope 항상 존재)
11. 응답 매핑에 `inviteCode` 미포함(WI-009 죽은 필드 제거 회귀)

질문: 6·10·11이 과한가, 아니면 빠진 핵심 케이스가 있나? POST(슈퍼어드민 가드 403)도 같은 하니스로 넣을 가치가 있나, 아니면 WI-011 범위(GET filter)에서 제외가 맞나?

## 결정 3 — useScreenRecorder unmount-settle 테스트
MockMediaRecorder.stop()은 onstop을 자동 발화 안 함(기존 테스트 패턴). 시나리오:
- (A) **settle**: start → stopRecording() 호출(state "stopping", `pendingStopResolveRef` 보관, onstop 미발화) → `unmount()` → cleanup이 onstop 제거 + `pendingStopResolveRef()` 호출 → stopRecording Promise resolve. unmount 전엔 pending, 후엔 settled 단언.
- (B) **mountedRef 가드**: start → stopRecording() → onstop 발화시키되 saveFile을 `window.showSaveFilePicker` deferred로 hang → unmount(mountedRef=false) → picker resolve → onstop이 `!mountedRef.current`로 setState 스킵하고 resolve. "언마운트 후 setState 없음" 검증.

질문: (B)가 결정적으로 재현 가능한가(act/microtask 타이밍), 아니면 (A)만으로 WI-006 P3 흡수에 충분한가? (B)를 넣되 불안정하면 (A) 우선?

## 공통
- 추측 금지, 실제 코드 확인 후 답변.
- 마지막에 **"내가 놓칠 위험 1가지"** 명시.
