# Auth: 슈퍼어드민 전역 스페이스 뷰 — 목록 전체 노출 + 관리 진입

**날짜**: 2026-06-21
**유형**: WI-009-feat (접근제어 / UX)
**머지**: develop `08fc2b9` (PR#4) · feat `fb484d6`
**검증**: 기계게이트 tsc/lint/vitest(52/52)/build PASS · 듀얼검증 codex PASS · evaluator WARNING 9.8 (P3×2 defer→WI-010-perf/WI-011-test) · 설계 codex consult 1R
**관련**: [WI-007 스페이스 생성 제한](2026-06-21-superadmin-space-creation.md)

## 개요

슈퍼어드민이 "내 스페이스" 화면에서 **모든 ACTIVE 스페이스**를 보고 관리(대시보드 진입)할 수 있게 한다. 사용자 확정 방식 = **"내 스페이스에 전체 노출"**.

백엔드 인가(`requireSpaceAdmin`)는 WI-007 시점부터 이미 슈퍼어드민을 항상 통과시켜 `/dashboard/spaces/<id>` 직접 URL 접근은 가능했다. 결손은 **목록/UI 진입점**뿐이었다 — `GET /api/spaces`가 멤버십 스페이스만 반환하고, `SpaceCard` '관리' 버튼이 `myRole` 관리역할에만 노출됐기 때문. 본 WI는 그 두 진입점만 보강한다.

## 변경 파일 (4)

| 파일 | 변경 | 내용 |
|------|------|------|
| `src/app/api/spaces/route.ts` | 수정 | GET: filter 분기 명시화 + 슈퍼어드민 "전체" 전역 scope + 미허용 filter 400 + 목록 응답 `inviteCode` 제거 |
| `src/components/spaces/space-card.tsx` | 수정 | `isSuperAdmin?` prop 추가, `isAdmin = 관리역할 \|\| isSuperAdmin` |
| `src/components/spaces/space-list-view.tsx` | 수정 | `SpaceCard`에 `isSuperAdmin` 전달 |
| `src/stores/space-store.ts` | 수정 | `SpaceItem`에서 죽은 `inviteCode` 필드 제거 |

## GET /api/spaces — filter 분기 (명시화)

```
filter        일반 사용자                    슈퍼어드민
"owned"   →   { ownerId: me }                동일
"joined"  →   { members.some.userId: me }    동일
null|"all"→   { members.some.userId: me }    {} (모든 ACTIVE 전역)
그 외     →   400 { error, code: "INVALID_FILTER" }
```

- 일반 사용자 동작은 **불변** (전역 `scope={}`는 `isSuperAdmin`일 때만 도달 — 비-슈퍼는 `memberScope`로 귀결, 권한상승/IDOR 차단).
- "전체"의 의미를 store의 쿼리파라미터 생략에만 의존하지 않도록 `null`과 `"all"`을 동일 분기로 의도 처리, 미허용 값은 400 거절 (codex 협의 반영 — 향후 `?filter=all` 명시 전송에도 회귀 없음).

## 관리 버튼 노출 (서버 권위)

```
my-spaces/page.tsx (서버컴포넌트)  → session.user.isSuperAdmin (JWT snapshot)
        ↓ prop
SpaceListView                      → SpaceCard isSuperAdmin
        ↓
SpaceCard: isAdmin = OWNER|STAFF || isSuperAdmin → '관리' 버튼
        ↓ 클릭
/dashboard/spaces/<id>             → requireSpaceAdmin 재검증 (실제 인가)
```

버튼 표시 근거는 서버 세션에서 온 prop(클라이언트 위조 불가)이며, 실제 인가는 클릭 후 서버에서 재검증된다. 버튼이 보여도 인가 우회는 불가 — 표시는 UI 상태일 뿐.

## inviteCode 제거 (좁은 노출)

- 목록 응답의 `inviteCode`는 목록/카드 UI가 전혀 소비하지 않던 **죽은 필드**였다 (join 흐름은 `/api/spaces/join/[inviteCode]` 라우트 파라미터 + 별도 `JoinSpaceView`, `addSpace` 스토어 액션은 호출처 없음).
- 슈퍼어드민 전역 노출 시 이 필드가 남으면 **모든 스페이스의 초대코드가 목록 한 번에 누출**됨 → 응답·`SpaceItem` 타입에서 제거. `accessSecret`은 WI-001에서 이미 응답에서 차단됨 — 본 WI는 신규 민감정보 노출 없이 오히려 노출을 축소.

## 알려진 한계 / 후속

- **WI-010-perf** (P3 defer): 슈퍼어드민 전역 `scope={}`는 페이지네이션 없이 모든 ACTIVE를 반환 → 스케일 시 비용 선형 증가. 기존 엔드포인트도 무페이지네이션이라 회귀는 아니나, take/cursor/상한 도입 필요.
- **WI-011-test** (P3 defer): filter 분기 자동 회귀 테스트 부재. 현재 vitest는 chat 유틸 한정 — API 라우트 테스트 하니스(auth/prisma mock) 신규 도입 필요.
