# 🔴 조사 우선순위 #1 — 인-스페이스 멤버 제재가 실제로 동작하지 않음 (다음 세션)

> **이 문서는 프레시 컨텍스트 전제로 자기완결적으로 작성됨. 다음 세션은 이 진단부터 시작.**
> **증분 패치 금지** — WI-035/038/039/044/045로 기능별 표면만 고쳐왔고 근본 원인을 못 짚었다. 먼저 root cause를 확정하고, 그 다음 한 번에 고친다.

## 증상 (사용자 라이브 실측, 2026-06-24)
운영계정 조용현(owner), "참가자 2명" 상태에서:
1. **음성 강제 음소거**(LiveKit moderate) → UI 빨간 메시지 **"참가자가 음성 방에 연결되어 있지 않습니다"** = `RoomServiceClient.getParticipant(space-${spaceId}, identity)` **404 PARTICIPANT_NOT_FOUND**. 그런데 **그 참가자는 패널에 비디오 타일로 보임**.
2. **채팅 음소거** → 눌러도 그 사람 채팅 계속 됨(무효).
3. **내보내기(kick)** → 동작 안 함(안 나감).
4. **차단(ban)** → 수동 새로고침해야 빠지고, 목록 유지.
5. **차단 해제(unban)** 메뉴 안 보임(WI-045에서 추가했는데).

→ **소켓 enforce 계층(mute/kick/ban 실시간)과 LiveKit 계층(음성/화상) 둘 다 함께 실패.** 함께 실패 = 공유 불변식이 깨짐.

## codex 근본 원인 가설 (consult 2026-06-24, scratchpad/consult-moderation-rootcause.out.txt)
### 1순위 — 제어 평면(control plane) 불일치
**서버가 보는 인스턴스 ≠ 사용자가 실제 붙은 인스턴스.**
- **LiveKit**: 클라는 `NEXT_PUBLIC_LIVEKIT_URL`로 접속, 서버 moderate/evict는 `LIVEKIT_URL`로 `RoomServiceClient` 생성. **두 값이 다른 LiveKit 서버/Cloud project/room namespace면 "클라엔 타일, 서버 getParticipant 404"가 정확히 발생.**
- **소켓**: 브라우저는 `NEXT_PUBLIC_SOCKET_URL`로 붙고, Vercel admin route는 `SOCKET_INTERNAL_URL`로 enforce 전송. **합성 archive probe는 OCI endpoint의 HMAC만 증명** — 라이브 Vercel 런타임이 같은 endpoint로 실제 mute/kick/ban을 보내는지, 그 endpoint에 사용자 socket이 붙어 있는지는 **미증명**.
- (codex가 SID 가설은 기각: `useLiveKitMedia.ts:68`이 `participant.identity`를 그대로 track.participantId로 넣음 → identity는 맞음.)

### 2순위 — 대상 식별자 불일치
같은 "그 사람"이 DB `SpaceMember.userId` · 소켓 JWT `socket.data.userId` · LiveKit identity `user-{userId}`에서 **모두 동일인인지 미확정**. 패널은 socket players + LiveKit participants 병합, PATCH는 `SpaceMember.id`, moderate는 identity, enforce는 `target.userId`. 한 축만 어긋나도 DB restriction은 바뀌나 라이브 socket 못 찾고 LiveKit 다른 identity/room 조회. **ban 후 새로고침해야 빠짐 = "라이브 제거는 빗나가고, reload 시 서버 게이트만 작동"**.

## 다음 세션 최소 진단 시퀀스 (결정적 체크 5개)
1. **실제 admin action 1회 Network 캡처**: `PATCH /admin/members` 응답의 `realtimeEnforced`/status/body + `POST /livekit/moderate` 요청 body의 `identity`. **`realtimeEnforced:false`면 소켓 문제는 Vercel dispatch 쪽 확정.** (사용자에게 DevTools Network 스크린샷 요청 or 브라우저 자동화)
2. **LiveKit 서버 listParticipants 대조**: Vercel이 쓰는 `LIVEKIT_URL/API_KEY/API_SECRET`로 `listParticipants("space-${spaceId}")` 조회 → 브라우저의 `room.name`·`localParticipant.identity`·`participantTracks.keys()`와 비교. **UI identity가 목록에 없으면 LiveKit 원인은 코드 아니라 URL/project/room 불일치.**
   - **선행 빠른 체크**: `vercel env pull`(루트에서 `vercel link` 먼저 필요 — 이번 세션 막힘)로 **`LIVEKIT_URL` vs `NEXT_PUBLIC_LIVEKIT_URL` 값 대조** + `SOCKET_INTERNAL_URL` vs `NEXT_PUBLIC_SOCKET_URL` 대조. 다르면 그게 1순위 근본.
3. **OCI 소켓 로그**: `ssh -i ~/.ssh/flowspace-oci ubuntu@144.24.72.143` → `docker logs flowspace-v2_socket_1`. 해당 참가자 `Connected:{userId}`·`joined {spaceId}` 찾고, admin action 직후 `/internal/enforce` 도착 여부. **판정: 요청 없음→Vercel env/URL / 409→DB postcondition·target / 200 affectedSockets:0→userId·socket 인스턴스 불일치 / 200 affectedSockets>0인데 무효→클라 재접속·상태처리.**
4. **대상 1명 4값 정렬**: `SpaceMember.id` · `SpaceMember.userId` · LiveKit identity `user-{id}` · OCI `socket.data.userId`. 그리고 **"참가자 2명"이 실제 다른 userId인지, 같은 계정 다중 탭인지** 확인.
5. **ban 후 `GET /admin/members`**: target row가 `BANNED`로 내려오나? 내려오는데 unban 메뉴 안 보이면 **패널 snapshot/refetch/row visibility** 문제(backend 아님). 안 내려오면 **PATCH 대상 memberId가 다른 row**.

## codex 놓칠 위험
**"테스트 참가자 2명"이 실은 같은 계정 다중 탭/중복 세션일 가능성.** 그러면 LiveKit 중복 제거 + socket presence `Map<userId,player>` 덮어쓰기 + self-target 회피가 섞여 UI상 2명처럼 보여도 제재 대상이 1명으로 붕괴. **→ 진단 전 "두 참가자가 서로 다른 실제 계정인지" 먼저 확정**(서로 다른 브라우저/계정으로 재현 권장).

## 핵심 검증할 불변식 (증분 패치가 가린 것)
- (I1) **동일 참가자를 3 시스템(DB·socket·LiveKit)이 같은 식별자로 본다.**
- (I2) **public endpoint(NEXT_PUBLIC_*)와 internal endpoint(LIVEKIT_URL/SOCKET_INTERNAL_URL)가 같은 런타임 인스턴스를 가리킨다.**

## 관련 파일/엔드포인트
- LiveKit moderate: `src/app/api/spaces/[id]/livekit/moderate/route.ts`(getParticipant 404 발생점), `src/features/space/livekit-moderation/internal/{moderation,eviction}.ts`
- LiveKit 토큰: `src/app/api/livekit/token/route.ts`(identity=`user-${session.user.id}` 파생, room=client roomName)
- 클라 LiveKit: `src/features/space/livekit/internal/useLiveKitMedia.ts:68`(track.participantId=participant.identity), `src/components/space/video/ParticipantPanel.tsx`
- 소켓 enforce: Vercel `src/features/space/enforce/internal/dispatch.ts`(SOCKET_INTERNAL_URL→/internal/enforce), OCI `server/handlers/enforce.ts`(verifyPostcondition/applyEnforcement), `server/handlers/room.ts`(join·presence Map<userId>)
- 멤버 매핑: `src/components/space/use-space-members.ts`, `member-actions-menu.tsx`
- env: Vercel `LIVEKIT_URL`·`NEXT_PUBLIC_LIVEKIT_URL`·`SOCKET_INTERNAL_URL`·`NEXT_PUBLIC_SOCKET_URL`·`SOCKET_INTERNAL_SECRET`. OCI `.env`. 라이브 소켓=`space-socket.flow-coder.com`, 웹=`space.flow-coder.com`.
