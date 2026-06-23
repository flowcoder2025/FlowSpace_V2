# WI-038-feat 설계 협의 (LiveKit moderator mute 서버 계약)

당신은 FlowSpace(Next.js 15 + LiveKit + socket.io 메타버스)의 시니어 설계 리뷰어입니다. 산문으로 답하세요. 마지막에 **"내가 놓칠 위험 1가지"**를 반드시 포함하세요.

## 목표 (WI-038, P2, 순 신규)
운영자(OWNER/STAFF/superAdmin)가 **다른 참가자의 음성(마이크) 트랙을 서버 측에서 강제 음소거**하는 서버 계약. 현 LiveKit은 self-mute만 존재(`LiveKitMediaContext`의 `setLocalMicrophoneMuted`). WI-038은 **서버 계약+권한+감사+실패처리**만. UI 연결은 후행 WI-039. **채팅 음소거(WI-035, restriction=MUTED, socket enforce)와는 완전 분리** — 이건 음성/미디어 레이어.

## 실측한 현 코드 사실 (검증 완료)
1. **LiveKit 서버 SDK 사용처는 단 2곳**(둘 다 inline, 별도 feature 모듈 없음):
   - `src/app/api/livekit/token/route.ts` — `AccessToken`+`RoomServiceClient`. 토큰 identity: 인증=`user-{userId}`, 게스트=`guest-{guestSessionId}`, dev=`dev-anon-{ts}`. **grant = `{room, roomJoin:true, canPublish:true, canSubscribe:true, canPublishData:true}`** (roomAdmin 없음). room명=`space-{spaceId}`. 멤버/owner/게스트세션 검증 후 발급. **LiveKit 미설정 시 prod는 503** 반환(dev는 devkey 폴백).
   - `src/app/api/livekit/webhook/route.ts` — `WebhookReceiver`. track_published/unpublished를 SpaceEventLog(VIDEO_START 등)로 기록.
2. **livekit-server-sdk v2.15.0** 실측 시그니처:
   - `mutePublishedTrack(room, identity, trackSid, muted) → TrackInfo` — **trackSid가 필요**(source 아님).
   - `getParticipant(room, identity) → ParticipantInfo` (참가자 없으면 throw). `ParticipantInfo.tracks: TrackInfo[]`, 각 `TrackInfo{ sid, source, muted, type }`. `TrackSource.MICROPHONE === 2`.
   - `updateParticipant(room, identity, options)` — `ParticipantPermission{ canSubscribe, canPublish, canPublishData, canPublishSources: TrackSource[], hidden }`.
   - `listParticipants(room)`, `removeParticipant(room, identity)`도 존재.
3. **권한 인프라**: `src/lib/space-role.ts` `canActOn(actorRole, targetRole, isSuperAdmin)` = isSuperAdmin OR rank(actor)>rank(target) (OWNER3>STAFF2>PARTICIPANT1, **동급 불가**). `requireSpaceAdmin` 패턴. admin/members PATCH(`src/app/api/spaces/[id]/admin/members/route.ts`)는 actor가 OWNER/STAFF/superAdmin인지 self 조회→403, target은 `memberId`(SpaceMember.id)로 조회, OWNER 보호, canActOn 게이트, 액션 mute/unmute/kick/ban/changeRole 후 SpaceEventLog(ADMIN_ACTION) 기록 + `dispatchEnforcement`(socket HMAC webhook)로 실시간 반영. **이 enforce 채널은 socket.io 서버용 — LiveKit과 무관**.
4. **socket enforce**(`src/features/space/enforce`, `server/handlers/enforce.ts`)는 HMAC 서명 내부 webhook으로 socket.io 서버의 살아있는 연결을 제재. **RoomServiceClient는 LiveKit 서버(LIVEKIT_URL)를 직접 HTTP 호출하므로 socket enforce 채널과 별개 — WI-038은 socket enforce 인프라 불필요로 보임.**
5. 모듈 구조: `src/features/space/{livekit,enforce,chat,socket}/` 각 `index.ts` 배럴 + `internal/`. ESLint `no-restricted-imports`로 타모듈 `internal/*` 직접 import 금지. 단, **livekit 서버 SDK는 현재 feature 모듈 없이 route에 inline**.
6. 테스트: `src/**/*.test.ts(x)` vitest, 하니스 `src/__tests__/helpers/api-route.ts`. livekit-server-sdk mock 선례 없음. `vi.mock("livekit-server-sdk")` 필요.

## 핵심 설계 긴장점 — 결정 요청
**Q1. 라우트 배치**: (A) 신규 전용 라우트 `POST /api/spaces/[id]/livekit/moderate`(또는 `mute`) vs (B) 기존 admin/members PATCH 확장. 내 판단: 음성 음소거는 **LiveKit participant identity**(게스트 포함·DB 행 없음·transient)를 대상으로 하고, members PATCH는 `memberId`(SpaceMember.id, 등록 멤버만, 게스트 enforce 제외)라 대상 모델이 다름 → **(A) 전용 라우트가 맞다**고 봄. 동의/반대?

**Q2. 대상 식별 & 권한 게이트**: 클라(WI-039)는 `participant.identity`(`user-{userId}`/`guest-{sessionId}`)를 가짐. 전용 라우트가 `{ identity, muted:boolean }`를 받고 room=`space-{spaceId}`로 파생. 권한: actor는 OWNER/STAFF/superAdmin 필수. 등록 대상(`user-{userId}`)은 SpaceMember.role 조회→`canActOn`; 게스트 대상(`guest-{sessionId}`)은 role이 없어 admin이 항상 제재 가능(가장 낮은 등급). identity 형식 검증(prefix allowlist)·room 소속 확인. 이 모델 타당? 게스트 대상 권한 처리·OWNER 대상 보호(자기 자신/owner mute 금지?)에서 놓친 부분?

**Q3. 재음소거(stickiness) — 가장 큰 결정**: 토큰 grant가 `canPublish:true`라 단순 `mutePublishedTrack(muted:true)`는 **참가자가 즉시 client에서 다시 unmute 가능**(advisory). 옵션:
- (a) **advisory soft mute만** — `mutePublishedTrack`만. 구현 단순하나 우회 즉시 가능(가치 의문).
- (b) **권한 회수 sticky** — `updateParticipant`로 `canPublishSources`에서 MICROPHONE 제거(재퍼블리시 차단) + 기존 트랙 `mutePublishedTrack`. 세션 내 sticky. 복잡도↑.
- (c) **재접속 영속** — DB에 음성음소거 상태 저장→재접속 토큰에 반영. **schema 변경=마이그레이션 승인 게이트**, 스코프 대폭 확대.
WI-038 P2 "서버 계약" 범위에서 (a)/(b)/(c) 중 무엇이 적정? 나는 (b) sticky-within-session이 균형점(우회 차단하되 schema 무변경)이라 보는데, (b)의 함정(canPublishSources 갱신이 기존 카메라/화면공유 퍼블리시에 미치는 영향, 재접속 시 grant가 canPublish:true로 리셋되어 mute 소실)을 어떻게 다뤄야 하나? 토큰 라우트 grant도 함께 손봐야 하나(현재 무조건 canPublish:true)?

**Q4. unmute 시맨틱**: 운영자 unmute = 트랙 강제 unmute(`mutePublishedTrack(muted:false)`)는 사용자가 스스로 끈 마이크를 운영자가 강제로 켜는 셈이라 침습적. (b)를 택하면 unmute=권한 복원(canPublishSources에 MICROPHONE 재추가)만 하고 실제 재개는 사용자에게 맡기는 게 맞나? force-unmute는 지원하지 말아야 하나?

**Q5. 실패/엣지 처리**: 대상이 room에 없음(getParticipant throw)→404 vs 멱등 200? 마이크 트랙 없음(아직 미퍼블리시)→ (b)면 권한만 회수하고 트랙 mute는 skip? LiveKit 미설정(prod no API key)→503(토큰 라우트 미러)? RoomServiceClient 호출 실패(LiveKit 다운)→500? 멱등성(이미 muted를 또 mute)?

**Q6. 모듈 배치 & 테스트성**: 순수 로직(identity prefix 파싱·권한 결정·MICROPHONE 트랙 찾기)을 `src/lib/livekit-moderation.ts`(또는 신규 feature 모듈 `src/features/space/livekit-moderation/`)로 분리해 vitest 가능하게 하고, RoomServiceClient orchestration은 route에 두는 게 토큰 라우트 inline 패턴과 일관? 아니면 feature 배럴 모듈이 옳나?

**Q7. 감사**: SpaceEventLog ADMIN_ACTION(action: "voiceMute"/"voiceUnmute", payload: targetName/targetIdentity/trackSid?)로 기록. 게스트 대상은 userId 없음 → SpaceEventLog.userId는 actor(session.user.id)로. 타당?

각 Q에 명확한 권고와 근거를 주고, **내가 놓칠 위험 1가지**로 마무리하세요.
