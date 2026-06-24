# 블라인드 적대 재검증 r2 — WI-047-fix 강퇴(kick) 쿨다운

너는 독립 적대 리뷰어다(r1에서 P1 TOCTOU를 적출했다). r2 수정을 **블라인드로** 재검증하라. 출력은 강제 JSON 스키마(reviewer="codex", verdict, issues P0~P3). 권위 판정은 마지막 agent_message JSON 하나.

## r1에서 네가 지목한 P1 (TOCTOU) — r2에서 해소함
`join:space`의 `isUserKicked`가 DB await **전에만** 검사돼, join 진행 중 kick 발생 시 그 소켓이 `socketsForUser`에 미포착되어 `socket.join`까지 도달하던 구멍.

**r2 수정(커밋 `ddfe2c2`)**:
- `server/handlers/room.ts`: archive 재확인과 **동일 위치**(모든 await 이후·`socket.join` 직전)에 `isUserKicked` 재확인을 추가. early 체크(DB 조회 전)는 효율용으로 유지하고, 권위 검증은 post-await 재확인. 공용 `KICKED_JOIN_ERROR` 상수.
- `src/lib/kick-cooldown.ts`: `mark` 시 opportunistic sweep(만료 entry 정리)로 P3 누수 해소. +2 테스트.

## 검증 지시
1. **P1 재확인**: post-await `isUserKicked` 재확인이 archive 재확인(`isSpaceArchived`)과 동일하게 `socket.join` 직전에 위치해 TOCTOU 창을 실제로 닫는가? in-flight join 중 kick → markUserKicked → 재개 후 재확인이 막는가? 남은 race 있나?
2. **sweep 정확성**: Map 순회 중 삭제 안전성, 재-kick 연장 보존(만료 전 키 미삭제), 유효 키 미삭제.
3. **회귀**: r2 변경으로 정상 입장/기존 archive 게이트/early 체크 손상 없나?
4. 새 결함 없나? 변경 파일을 직접 읽어 검증(`git show ddfe2c2`, base 72af3e5의 원 변경은 `git diff develop...HEAD`).

게이트 실측(권위 환경): tsc0/lint0err/vitest 650 pass/esbuild0(런타임 src 입력 5개 COPY 일치). codex sandbox vitest는 spawn EPERM으로 미실행될 수 있음 — 코드 인스펙션이 주 근거.

**여전히 놓쳤을 결함 1가지**도 지목하라.
