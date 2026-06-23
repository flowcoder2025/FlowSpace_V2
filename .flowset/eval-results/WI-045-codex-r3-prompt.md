너는 FlowSpace 독립 블라인드 코드 검증자(codex)다. WI-045-feat **r3**(impl `d1b18b0`) 재검증. 출력 스키마 JSON 하나만(verdict PASS|WARNING|FAIL, issues P0~P3).

## r2 → r3 변경(네 r2 P2[fixNow] 해소)
**r2 적출 P2**: `src/app/api/livekit/token/route.ts` BANNED 가드 `if (!space && spaceMember?.restriction === "BANNED")`의 `!space` 예외가 BANNED owner 를 면제 → 소켓 join 게이트(room.ts L94: owner 면제 없이 `restriction==="BANNED"`→reject)와 불일치(소켓은 차단·화상은 허용하는 갭).

**r3 해소**: `!space &&` 제거 → `if (spaceMember?.restriction === "BANNED") return 403 code:BANNED`. 근거: (a) 정상 owner 는 admin 라우트 owner 보호로 애초에 BANNED 안 됨 → 정상 owner 무영향(restriction≠BANNED) (b) 데이터 드리프트/superAdmin 으로 BANNED 된 owner 라면 소켓과 동일하게 차단해야 일관. 회귀 테스트 +1(BANNED 멤버가 owner[space 매치]여도 403 — `!space` 재도입 변이 검출).

## 재검증 관점
- r3 가드(`spaceMember?.restriction === "BANNED"`)가 소켓 게이트(room.ts)와 완전 일관? 정상 owner(restriction NONE 또는 멤버행 없음[spaceMember=null→undefined])는 통과? 게스트 경로 무영향?
- 회귀 테스트가 owner 예외 재도입(`!space &&`)을 변이검출? 
- r1/r2 본체(kick 무삭제·LiveKit best-effort·unban·eviction stubEnv) 무회귀? 새 결함 없나?
- 게이트: tsc0 / eslint 0err(선재 LiveKit 경고1) / vitest 578→579(+1) / build0.
