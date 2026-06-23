블라인드 코드 검증 — WI-038-feat: LiveKit moderator mute 서버 계약 (타인 음성 강제 음소거)

당신은 독립 적대 검증자입니다. 아래 변경을 read-only로 직접 실측해 결함을 찾아내고, 출력 스키마에 맞춰 JSON으로만 답하세요(verdict PASS|WARNING|FAIL, issues P0~P3 + defer/deferRationale/fixNow). 다른 검증자(evaluator)의 산출물을 절대 참조하지 마세요.

## 목표
운영자(OWNER/STAFF/superAdmin)가 다른 참가자의 마이크를 **서버 측에서 강제 음소거/해제**하는 전용 라우트 추가(순 신규). 현 LiveKit은 self-mute만 존재. 채팅 음소거(WI-035 restriction=MUTED·socket enforce)와 별개의 음성/미디어 레이어. UI 연결은 후행 WI-039(이 WI는 서버 계약+권한+감사+실패처리만).

## 변경 범위 (HEAD 커밋 = `git show HEAD`, base = develop)
### 신규 파일
- `src/features/space/livekit-moderation/internal/moderation.ts` — server-safe 순수 로직: `parseParticipantIdentity`(user-/guest- allowlist), `findMicrophoneTrack`, `computePublishSourcesForMute/Unmute`, `buildModeratedPermission`.
- `src/features/space/livekit-moderation/index.ts` — 배럴.
- `src/features/space/livekit-moderation/internal/moderation.test.ts` — 순수 단위 20.
- `src/app/api/spaces/[id]/livekit/moderate/route.ts` — `POST` 핸들러(권한·LiveKit orchestration·감사·실패처리).
- `src/app/api/spaces/[id]/livekit/moderate/route.test.ts` — 라우트 19(SDK mock).

### 설계 의도(검증 기준)
1. **모듈 경계**: `src/features/space/livekit` 배럴은 클라이언트 전용(React provider/hook)이라 서버 라우트가 import하면 클라 코드가 끌려옴 → enforce 모듈처럼 server-safe 별도 모듈로 분리. moderation.ts는 React/클라 의존 없어야 함.
2. **stickiness=세션 내(권한 회수)**: 토큰 grant가 `canPublish:true`라 단순 mute는 사용자가 즉시 재-unmute 가능 → `updateParticipant`로 `canPublishSources`에서 MICROPHONE 제거(재퍼블리시 차단) + 기존 mic 트랙 `mutePublishedTrack`. **updateParticipant permission은 atomic("all desired permissions would need to be set")** — 현재 permission(canSubscribe/canPublish/canPublishData/hidden) 보존하고 canPublishSources만 mic add/remove해야 함(다른 source 제재 해제 방지). 재접속 시 mute 소실은 의도된 한계(토큰 grant 무변경).
3. **canPublishSources 시맨틱**: `[]`=전체 허용, non-empty=명시 allowlist. mute: `[]`→`[CAMERA,SCREEN_SHARE,SCREEN_SHARE_AUDIO]`; non-empty→mic 필터. unmute: `[]`→`[]`; non-empty→mic 추가.
4. **권한 게이트**: actor는 OWNER/STAFF/superAdmin(self SpaceMember 조회·없고 비-superAdmin이면 403). identity allowlist user-/guest-만(dev-anon·bare·빈 remainder 거부=400 INVALID_IDENTITY). self 대상 거부(400 SELF_TARGET). user-* 대상은 SpaceMember.role 조회→없으면 404 TARGET_NOT_MEMBER→OWNER 보호(superAdmin 아니면 403)→`canActOn(actorRole,targetRole,isSuperAdmin)`(동급 불가). guest-*는 role 없어 최하위→admin 항상 제재가능(room 소속은 getParticipant로 확인).
5. **실패/엣지**: LiveKit 미설정(prod no key)→503 LIVEKIT_NOT_CONFIGURED(토큰 라우트 미러·dev devkey 폴백). getParticipant throw(room에 없음)→404 PARTICIPANT_NOT_FOUND. mic 트랙 없음→200 권한만 회수·trackSid:null. 이미 muted→200 idempotent(mutePublishedTrack 미호출). updateParticipant/mutePublishedTrack throw→502 LIVEKIT_OPERATION_FAILED(raw 미노출·console.error). 순서: 권한 회수 먼저→트랙 mute.
6. **unmute=권한 복원만**: force-unmute 안 함(`mutePublishedTrack(false)` 미호출 — 사용자 self-mute 보존).
7. **감사**: SpaceEventLog ADMIN_ACTION(userId=actor, payload action voiceMute/voiceUnmute + targetName + targetIdentity), 두 LiveKit 작업 완료 후 best-effort(로그 실패가 200을 500으로 뒤집지 않음 — 부수효과 이미 적용).
8. **정보위생**: 에러 응답에 raw error.message 미노출({error,code}만, WI-023 internalErrorResponse 패턴). 예상 외 throw는 internalErrorResponse 500.
9. **Vercel 전용**: token route grant·server/·prisma/ schema 무변경.

## 능동 실측 지시
- `git show HEAD` / 각 파일 직접 read. base 대비: `git diff develop..HEAD`.
- 기계게이트 재현 권장: `npx tsc --noEmit`(0 기대) / `npx vitest run`(540 기대, 501→540) / `npm run build`(0 기대, 무거움).
- LiveKit SDK 실제 시그니처 확인: `node_modules/livekit-server-sdk/dist/RoomServiceClient.d.ts`(`mutePublishedTrack(room,identity,trackSid,muted)`·`updateParticipant(room,identity,{permission})`·`getParticipant`). `ParticipantInfo.permission?`·`ParticipantPermission.canPublishSources`·`TrackSource.MICROPHONE===2`는 `node_modules/@livekit/protocol/dist/index.d.ts`.
- 토큰 라우트 grant/identity 형식 확인: `src/app/api/livekit/token/route.ts`(grant canPublish:true·identity user-/guest-/dev-anon-).
- `canActOn`/role rank: `src/lib/space-role.ts`. admin/members 권한 패턴 정합: `src/app/api/spaces/[id]/admin/members/route.ts`.

## 적대적 점검 포인트(놓치기 쉬운 결함)
- **codex consult가 지목한 최대 위험**: `buildModeratedPermission`이 현재 permission을 보존하지 않고 canPublishSources를 하드코딩 복원하면 향후 다른 source 제재(예: 화면공유 제한)를 실수로 해제. 현재 구현이 canSubscribe/canPublish/canPublishData/hidden을 보존하는가? 변이로 확인.
- `canPublishSources` `[]`=전체허용 시맨틱 처리 정확성. mute 시 `[]`를 빈 배열 그대로 두면(=전체 허용) mic가 안 막힘 — 명시 목록으로 좁히는가? unmute 시 `[]`를 유지하는가(이미 전체 허용)?
- 권한 회수→트랙 mute 순서가 실제 코드에서 보장되는가(race 창). 부분 성공(권한 회수 성공·트랙 mute 실패) 시 감사 로그가 성공처럼 남는가?
- self 대상 판정이 user-{actorUserId} 정확 매칭인가. guest가 자기 자신일 수 있나(actor는 항상 로그인 유저라 불가능한가)?
- identity 파싱 우회: `user-`만 있고 remainder 빈 값, `guest-`+공백, 대문자 prefix, prototype 오염(`__proto__`) 등.
- getParticipant 실패를 무조건 404로 처리 — LiveKit 장애(네트워크)도 404로 가려지는가? 이게 의도된 트레이드오프인가, stale을 숨기나?
- LiveKit op 실패 502 시 raw error.message가 응답에 새는가? console.error 외 노출?
- 멱등성: 이미 mic 권한 없는 상태에서 또 mute → updateParticipant 재호출 무해한가? 이미 muted 트랙 재-mute 스킵?
- 감사 로그 best-effort `.catch`가 실제 결함(ADMIN_ACTION 미기록)을 가리는 보안/컴플라이언스 갭인가, 아니면 정당한가(부수효과 이미 적용·idempotent)?
- 권한 게이트 순서: self 거부가 LiveKit 호출 전인가(불필요 SDK 호출 회피). actor 게이트가 target 게이트보다 먼저인가(정보 노출 최소).
- moderation.ts가 `livekit-server-sdk`에서 TrackSource를 import — 서버 라우트 번들에 무거운 SDK가 끌려오는 문제? (라우트도 이미 SDK 사용하므로 추가 표면 아님 — 확인.)
- 테스트 false-pass: SDK mock이 TrackSource를 실제 enum으로 유지하는가(importOriginal)? 권한 보존/순서/idempotency 변이를 잡는 강한 오라클인가?
- DELETE/POST CSRF·인증: 동일 출처 fetch·NextAuth 세션 — 기존 admin 라우트와 동일 패턴인가?

각 이슈는 severity/location/description/recommendation/defer/fixNow를 채우세요. 결함이 없으면 issues=[] + verdict=PASS.
