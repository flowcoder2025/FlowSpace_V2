# 블라인드 적대 검증 — WI-014-fix: API 응답 민감필드 allowlist 정형화

당신은 독립 코드 검증자(codex)다. read-only로 레포(브랜치 `fix/WI-014-fix-response-allowlist`)를 검토하고, **반드시 제공된 JSON 스키마로만** 산출하라. 추측 금지 — 파일:라인 근거로만. evaluator(Claude) 산출물을 절대 참조하지 마라(상호 블라인드).

## WI-014 목표
GET 경로들이 이미 적용한 응답 allowlist 원칙(app.md 서버 불변식 #2 "select/include 명시 — 필요한 필드만")을, 누락돼 있던 POST/PATCH 응답에도 적용해 민감/내부 필드 누출을 차단한다. 인가 게이트는 이미 존재(저위험)하나 GET과의 정합성·정보위생 결함.

## 변경 (4개 라우트 + 4개 테스트, 소스만 — 런타임 동작은 응답 본문 축소뿐)
1. `src/app/api/spaces/route.ts` POST 201 응답에서 `inviteCode` 제거 → `{ id, name, template }`. (클라 `create-space-form`은 응답 본문 미사용, `res.ok`만 확인 후 `/my-spaces` 이동.)
2. `src/app/api/spaces/[id]/route.ts` PATCH가 `prisma.space.update`에 `select` allowlist 추가(id/name/description/accessType/maxUsers/status/logoUrl/primaryColor/loadingMessage/createdAt) → `accessSecret`/`inviteCode`/`ownerId`/`templateId`/`mapData` 미반환. 기존 `NextResponse.json(updated)` 전체 Space 반환을 대체. (클라 `space-settings-form` 응답 본문 미사용.)
3. `src/app/api/spaces/[id]/members/route.ts` PATCH가 `update`에 `select: {id,role,restriction}` 추가 → `restrictedBy`/`restrictedReason`/`restrictedUntil`/`userId`/`guestSessionId` 미반환. (이 라우트는 현재 클라 호출 없음.)
4. `src/app/api/spaces/[id]/admin/members/route.ts` PATCH가 `update`에 `select: {id,role,restriction}` 추가 → 응답 `{ member: updated, realtimeEnforced }`의 `member`에서 `restrictedBy` 등 미노출. (클라 `member-table`은 `res.ok`만, 멤버목록은 GET으로 별도 로드.)
   - `select` 추가가 후속 코드(spaceEventLog.create, dispatchEnforcement)에 영향 없는지 확인(이들은 `target`/`memberId`/`updatedRole` 사용, `updated`는 응답에만).
5. 테스트: `route.test.ts` POST 테스트 갱신(inviteCode 미노출) + 신규 `[id]/route.test.ts`·`[id]/members/route.test.ts`·`[id]/admin/members/route.test.ts`(update select arg 단언 = 변이검증).

## 검토 관점
- 응답에서 제거한 필드를 **클라이언트나 다른 서버 코드가 실제로 소비**하지 않는지(회귀 위험). 특히 PATCH space/admin-members 응답.
- `select`로 인해 누락되면 안 되는 필드를 실수로 빼지 않았는지(예: 클라가 쓰는 필드).
- POST의 `inviteCode` 제거가 스페이스 생성 후 초대 흐름을 깨지 않는지(생성자가 inviteCode를 다른 경로로 얻는가 — GET 상세도 inviteCode 미반환).
- 쓰기(data)에는 반영되나 읽기(select)에서만 차단되는 필드(accessSecret/restrictedBy)의 의도가 정확한지.
- app.md 서버 불변식(#2 select 명시, #4 에러형식) 위반 여부. 회귀(기계게이트는 tsc0/lint0/vitest 155·155/build0 통과).
- 놓친 동일 클래스 누출(다른 라우트의 `NextResponse.json(rawPrismaObject)`)이 있으면 지목.

## r2 추가 변경 (r1 codex P1 반영)
r1에서 codex가 지목: PATCH 응답은 정형화했으나 **`GET /api/spaces/[id]/admin/members`(line 32)가 raw SpaceMember 행 반환** → member-table이 PATCH 후 이 GET을 재요청(onRefresh)하므로 restrictedBy/restrictedReason/restrictedUntil 등이 결국 클라 도달 → PATCH 정형화 무력화. r2 해소:
6. `src/app/api/spaces/[id]/admin/members/route.ts` GET을 `include`→`select` allowlist(id/role/restriction/displayName/userId/createdAt/user{id,name,email,image}/guestSession{id,nickname})로 변경. `restrictedBy`/`restrictedReason`/`restrictedUntil`/`guestSessionId`/`spaceId`/`updatedAt` 미반환. **`userId`는 유지** — `media-management.tsx`가 스포트라이트 대상 선택에 사용(이미 `user.id`로 노출되는 값과 동등, 신규 누출 아님). 소비처 합집합(member-table + media-management) 보존.
7. `src/app/api/spaces/route.ts` POST create를 `include`→`select`(id/name/template)로 변경 — accessSecret/inviteCode를 애초에 fetch 안 함(불변식 #2, r1 P3 해소).
8. GET admin/members allowlist 회귀 테스트 추가(findMany select arg 단언).

검토 시: GET admin/members select가 두 소비처(member-table·media-management)의 필수 필드를 누락하지 않는지, restricted*가 GET·PATCH 양쪽에서 차단되는지 확인.

이슈는 severity P0~P3 + defer/deferRationale/fixNow로 분류. P0/P1 또는 fixNow=true가 있으면 verdict=FAIL, 경미한 defer만 있으면 WARNING, 무결하면 PASS.
