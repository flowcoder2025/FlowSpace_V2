블라인드 코드 검증 — WI-036-fix: 스페이스 archive 하드닝 (deletedBy 감사 + 접속자 추방/알림)

당신은 독립 적대 검증자입니다. 아래 변경을 read-only로 직접 실측해 결함을 찾아내고, 출력 스키마에 맞춰 JSON으로만 답하세요(verdict PASS|WARNING|FAIL, issues P0~P3 + defer/deferRationale/fixNow). 다른 검증자의 산출물을 참조하지 마세요.

## 변경 범위 (HEAD 커밋 = `git show HEAD`)

DELETE /api/spaces/[id]가 `status=ARCHIVED + deletedAt`만 기록하고 접속 중 사용자를 방치하던 결함 해소.

### 변경 파일
- `prisma/schema.prisma` — Space.deletedBy String? 추가.
- `prisma/migrations/20260623180000_space_deleted_by/migration.sql` — 멱등 ADD COLUMN IF NOT EXISTS.
- `src/features/space/enforce/internal/contract.ts` — EnforceRequest를 discriminated union으로 분리(UserEnforceRequest userId 필수 / ArchiveEnforceRequest userId 없음) + parseEnforceRequest archive 분기.
- `src/features/space/enforce/index.ts` — 신규 타입 배럴 export.
- `src/app/api/spaces/[id]/route.ts` — DELETE가 updateMany(status!=ARCHIVED) 원자 갱신(deletedBy 최초 행위자 보존) + dispatchEnforcement(action:"archive").
- `src/app/api/spaces/[id]/admin/members/route.ts` — EnforceAction → EnforceUserAction 타입 갱신.
- `server/handlers/enforce.ts` — verifyPostcondition archive 분기(Space.status===ARCHIVED) + applyEnforcement archive 분기(socketsInSpace 스냅샷 → emit space:error → detach → purgeSpaceState → markSpaceArchived).
- `server/handlers/room.ts` — archivedSpaces deny cache(markSpaceArchived/isSpaceArchived) + purgeSpaceState(spacePlayersMap+recording/spotlight/proximity) + join:space TOCTOU 가드.
- 테스트: contract.test.ts(+archive 파싱 6), route.test.ts(+DELETE 9).

### 설계 의도(검증 기준)
1. **deletedBy 감사 무결성**: 최초 archive 행위자만 기록, 재삭제·동시요청에 덮어쓰지 않음(updateMany status!=ARCHIVED 원자성).
2. **접속자 추방**: archive 시 그 공간 모든 소켓을 실시간 추방(snapshot→detach→disconnect) + 공간 인메모리 상태 전부 정리.
3. **시크릿 유출 방어**: archive enforce도 DB postcondition(status===ARCHIVED) 재확인 후에만 적용(409).
4. **TOCTOU**: archive 직전 status=ACTIVE를 읽은 in-flight join이 살아남지 않도록 deny cache + join 직전 재확인.
5. **회귀 0**: 기존 멤버 제재(ban/kick/mute/unmute/role) 동작·파싱 무변경. deletedBy는 어떤 응답 DTO에도 미노출.

## 능동 실측 지시
- `git show HEAD` / 각 파일 직접 read.
- 기계게이트 직접 재현 권장: `npx tsc --noEmit`(0 기대) / `npx vitest run`(478 기대) / 서버 esbuild 번들(`npx esbuild server/index.ts --bundle --platform=node --target=node20 --outfile=/dev/null --external:@prisma/client --external:.prisma/client` 0 기대).
- 마이그레이션 SQL이 schema.prisma와 정합한지: `npx prisma migrate diff --from-schema-datamodel <git HEAD~1 schema> --to-schema-datamodel prisma/schema.prisma --script` (Space.deletedBy 단일 컬럼 add만 기대).

## 적대적 점검 포인트(놓치기 쉬운 결함)
- discriminated union narrowing이 applyEnforcement/verifyPostcondition에서 정확한가(archive 외 분기에서 req.userId 접근 안전?).
- parseEnforceRequest archive 분기가 입력 userId/role을 채택하지 않는가(식별자 혼입).
- applyEnforcement archive에서 detach 전 snapshot이 실제로 mutation-during-iteration을 막는가.
- purgeSpaceState가 space-키 인메모리 맵을 빠짐없이 정리하는가(누락 맵?). chat의 rate-limit/reaction 맵을 잘못 포함/제외했는가.
- DELETE updateMany count===0 경로(이미 archived)에서 deletedBy 보존이 실제 보장되는가. 동시 DELETE race.
- deny cache 메모리 누수/무한 증가 위험과 그 trade-off가 정당화됐는가.
- Dockerfile.socket COPY 완전성(번들 런타임 src 입력 변화?). room.ts의 ../state import가 새 COPY를 요구하는가(server/는 전체 COPY인지).
- deletedBy가 GET/PATCH/DELETE 응답 어디에도 새지 않는가.

각 이슈는 severity/location/description/recommendation/defer/fixNow를 채우세요. 결함이 없으면 issues=[] + verdict=PASS.
