너는 FlowSpace 독립 블라인드 코드 검증자(codex)다. WI-045-feat **r2**(impl `9c61409`) 재검증. 출력 스키마 JSON 하나만 최종 메시지로(verdict PASS|WARNING|FAIL, issues P0~P3). evaluator 산출물 참조 금지.

## r1 → r2 변경(네 r1 FAIL P1×2 해소)
**r1 적출 P1×2(둘 다 fixNow) 해소했다:**
1. `src/features/space/livekit-moderation/internal/eviction.test.ts`: `process.env.NODE_ENV = ...` 직접 대입(TS2540×4·tsc 실패) → **`vi.stubEnv`/`vi.unstubAllEnvs`** 로 교체(WI-018 socket-startup.test.ts 패턴). 키 부재는 `stubEnv(k,"")`(falsy)로 표현. **tsc 재실행 0 확인.**
2. `src/app/api/livekit/token/route.ts:161`: SpaceMember 존재만 확인(`select:{id:true}`)하고 restriction 미검사 → **차단(BANNED) 유저가 화상 토큰을 새로 받아 재입장**(ban 의 removeSpaceParticipant 우회). → `select:{id:true, restriction:true}` + **`if (!space && spaceMember?.restriction === "BANNED") return 403 code:BANNED`** 추가(소켓 join 게이트 room.ts BANNED 와 정합·공간 소유자[space]는 차단 불가라 항상 허용). 신규 회귀 테스트 `route.test.ts` 3(BANNED→403·NONE 비차단·select restriction 포함, 모듈 const config 캡처라 vi.stubEnv+resetModules+동적 import).

## r1에서 이미 검증된 WI-045 본체(재확인만)
kick=멤버 미삭제(재입장 허용)+enforce kick(소켓 disconnect)+removeSpaceParticipant(LiveKit) / ban=BANNED+enforce+removeSpaceParticipant / unban=restriction NONE·enforce 미발송 / enforce.ts kick postcondition `member!==null && !BANNED` / menu banned→unban만 / eviction.ts best-effort.

## 재검증 관점
- **r2 수정 정확성**: (1) eviction.test.ts vi.stubEnv 전환이 tsc TS2540 해소+테스트 의미 보존(빈문자열 falsy=미설정)? (2) token route BANNED 가드가 정확한 위치(토큰 생성 전·소유자 예외)·정합(소켓 BANNED 게이트와)·우회 완전 차단? 게스트(sessionToken) 경로 무영향? 
- **신규 회귀**: token route 테스트가 BANNED 403 실증·변이 가능(가드 제거 시 FAIL)?
- **잔여**: r1 defer P3(DEV키 중복·게스트 화상 미커버·EvictionResult reason 미반영)는 범위 밖. 새 결함 없나?
- 게이트: tsc0 / eslint 0err(선재 LiveKit 경고1) / vitest 575→578(+3) / build0.

코드 직접 읽고 적대 판정.
