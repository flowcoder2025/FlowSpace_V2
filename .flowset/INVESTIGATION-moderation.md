# 🔴 조사 — 인-스페이스 멤버 제재가 실제로 동작하지 않음

> **이 문서는 프레시 컨텍스트 전제로 자기완결적으로 작성됨.**
> **증분 패치 금지** — WI-035/038/039/044/045로 기능별 표면만 고쳐왔고 근본 원인을 못 짚었다. 먼저 root cause를 확정하고, 그 다음 한 번에 고친다.

---

## 🟢 2026-06-24 Session 2 — 근본원인 **확정** + 수정방향 결정 (아래 옛 섹션들 supersede)

**상태: 사용자 지시로 임시보류(라이브 재현 직전 중단). 다음 세션은 다른 작업 시작. 이 섹션이 최신 결론.**

### 실측으로 확정된 사실 (전부 직접 검증, OCI SSH·Vercel env pull·prod DB·codex consult r2)
- **설정·인프라 100% 정상** — 조사 가설 #1(제어평면)·#2(식별자) **둘 다 실측 반증**:
  - Vercel(flowspace-v2 prod)↔OCI 모든 시크릿 **sha256 일치**: `SOCKET_INTERNAL_SECRET`·`AUTH_SECRET`·`LIVEKIT_API_SECRET`·`LIVEKIT_API_KEY=APIckbN3jsUGFhP`. URL 전부 정상(`SOCKET_INTERNAL_URL`/`LIVEKIT_URL`/`NEXT_PUBLIC_*`).
  - **LiveKit은 OCI 자체호스팅**(컨테이너 `flowspace-livekit`, Caddy `space-livekit.flow-coder.com`→172.18.0.1:7880). 클라 wss = 서버 REST = **동일 인스턴스**. prod 시크릿으로 `listRooms` → **200 인증 성공**.
  - 식별자 정상: LiveKit·소켓 로그 모두 `user-{userId}`. `socket.data.userId`=JWT=`session.user.id`=`SpaceMember.userId` 동일 파생.
  - Caddy 라우팅 정상, `/internal/enforce` 공개도달 정상(무서명 POST→401 "Missing signature"). **단 enforce 핸들러는 정상요청(401/403/409/200)을 로깅 안 함** → "로그에 enforce 없음"으로 도달여부 판정 불가(이전 세션 오판 주의).
- **PATCH 정상 작동** — prod DB `SpaceMember`: test(`cmltb99mb...`) 행에 ban/mute가 **정확히 기록**됨. `SpaceEventLog` ADMIN_ACTION 12건이 PATCH 실행 증명. codex 가설 "PATCH가 DB 미변경/다른 row" **반증**.

### 🔴 진짜 원인 (다층 — 단일 아님)
1. **(과거 최대 원인, WI-045가 이미 해소)** 2026-06-23 ADMIN_ACTION 로그에서 test가 **같은 space에 SpaceMember.id 2개**(`cmqqscolt...`→`cmqqw9v1w...`) = 멤버 row **삭제→재생성**. 원인 = **pre-WI-045 `kick = spaceMember.delete`**. row 삭제 후 재입장 시 **새 row(restriction=NONE)** 생성 → mute/ban이 매 사이클 초기화. **현재 src에 `spaceMember.delete` 없음**(admin/members route.test.ts L188이 "delete 미호출" 명시 단언). **사용자 원 repro(2026-06-23)는 WI-045 승격 전 코드 = 이 버그가 살아있던 때.** → "전부 미동작" 체감의 대부분이 이 한 버그.
2. **(현재 확정 결함) kick이 클라 자동재연결로 무력화** — kick은 DB 상태 무변경 + 소켓 disconnect만. socket.io 재연결이 `join:space` 자동 재발송(`use-socket.ts:325` `reconnect` 핸들러). DB상 정상 멤버라 즉시 복귀. **codex r2도 "확정 결함" 판정.** WI-045 후에도 남음.
3. **(증폭기) 클라 재연결 루프** — `use-socket.ts:517-525` `pagehide`/`beforeunload`가 `leave:space`+`disconnectSocket()`, effect deps `[spaceId,userId,nickname,avatar]` 변경 시 cleanup도 동일. OCI 로그 "client namespace disconnect" 반복과 일치. → voice-mute 404(stale tile: 대상이 moderate 시점에 LiveKit room 이탈) + ban "새로고침 필요"(패널이 `participant_left`/`player:left`/refetch 의존) 유발.
4. **mute/ban — 현재 코드선 정상 가능성 높음**(DB 지속·재입장 시 `spaceId_userId`로 row 재사용·restriction 재독). **단 WI-045 승격 후 admin 액션 로그 0건 → 현 배포 미검증.** ← 다음 세션 라이브 재현으로 확정 필요.
5. **놓칠 위험(codex)**: 라이브에 **구버전 클라 번들/탭** 혼재 가능. e2e/하니스로 서버·프로토콜 먼저 판정 후 브라우저 UI 판정.

### 결정된 수정 방향 (사용자 승인)
- **kick 시맨틱 = 서버 쿨다운 + 클라 둘 다**: 서버 `kickedUntil`(예 30s) 상태 → 그 기간 `join:space`·LiveKit 토큰 거부(BANNED 영구 restriction과 **분리**). 클라: `KICKED` 수신 시 해당 공간 자동재연결 중단 + `/my-spaces` 이동. (서버 게이트 없으면 악성/구버전 클라에 뚫림 — codex.)
- **검증 = 라이브 재현**(사용자 함께). 절차는 아래 "다음 세션 라이브 재현".
- 부수 수정 후보: 재연결 루프 트리거 차단(불필요 pagehide/deps remount), voice-mute stale-tile UX, **unban 도달성**(차단된 멤버는 패널에 안 떠 unban 메뉴 불가 — 패널 외 멤버관리 UI 또는 별도 경로 필요), LiveKit webhook URL 정정(`v2.flow-coder.com` no-resolve·`flow-metaverse.vercel.app` 구버전 → `space.flow-coder.com`; moderation 무관하나 부채).

### ⚠️ 이번 세션 prod 상태 변경 (반드시 인지)
- **test(`cmltb99mb...`) @ space `cmqpe3ubf0002lb046nrfuy8h`("당근 강의실") restriction을 BANNED→NONE으로 리셋**(라이브 재현 활성화용, prisma 직접 update). 재현 미수행으로 **현재 NONE 상태**. 필요 시 재차단 또는 그대로 둠.

### 다음 세션 라이브 재현 (보류된 절차)
owner(조용현)+test 2계정 입장(test 카메라 ON) → owner가 test ⋮ 메뉴에서 순서대로: ①채팅음소거(test 채팅 막히나?+`PATCH`의 `realtimeEnforced`) ②음성음소거(`POST .../livekit/moderate` status?) ③강퇴(나갔다 자동복귀?) ④차단(사라지나/재입장?). **test 브라우저 새로고침 금지**(재연결 루프가 결과 흐림). OCI 로그 disconnect **사유**로 판정: `server namespace disconnect`=서버추방 동작 / `client namespace disconnect`=클라발. enforce 핸들러 무로깅이라 mute/voice는 사용자 관찰 의존.

**codex consult r2 전문**: 세션 scratchpad `consult-mod-r2.out.txt`(없으면 재consult). codex 결론 = "5개 동일원인 아님, kick=확정결함(자동재연결), 재연결루프=증폭기, mute/ban은 DB SoT라 진짜 실패면 PATCH/다른row 또는 stale UI".

---
<br>

## (이하 2026-06-24 Session 1 섹션 — 위 Session 2가 supersede, 이력 보존용)

## 증상 (사용자 라이브 실측, 2026-06-24)
운영계정 조용현(owner), "참가자 2명" 상태에서:
1. **음성 강제 음소거**(LiveKit moderate) → UI 빨간 메시지 **"참가자가 음성 방에 연결되어 있지 않습니다"** = `RoomServiceClient.getParticipant(space-${spaceId}, identity)` **404 PARTICIPANT_NOT_FOUND**. 그런데 **그 참가자는 패널에 비디오 타일로 보임**.
2. **채팅 음소거** → 눌러도 그 사람 채팅 계속 됨(무효).
3. **내보내기(kick)** → 동작 안 함(안 나감).
4. **차단(ban)** → 수동 새로고침해야 빠지고, 목록 유지.
5. **차단 해제(unban)** 메뉴 안 보임(WI-045에서 추가했는데).

→ **소켓 enforce 계층(mute/kick/ban 실시간)과 LiveKit 계층(음성/화상) 둘 다 함께 실패.** 함께 실패 = 공유 불변식이 깨짐.

## ✅ 이번 세션 검증 결과 (2026-06-24) — codex 1순위 반증, #2로 좁힘
- **두 참가자는 다른 계정**(같은 PC·다른 브라우저). → codex 놓칠위험(같은 계정 다중탭) **배제**.
- **제어평면 URL 대조(flowspace-v2 prod env 실측)** — codex 1순위(제어평면 불일치) **반증**:
  - LiveKit: 서버 `LIVEKIT_URL=https://space-livekit.flow-coder.com` ↔ 클라 `NEXT_PUBLIC_LIVEKIT_URL=wss://space-livekit.flow-coder.com` = **같은 호스트**(scheme만 https REST/wss ws — 정상).
  - 소켓: 서버 `SOCKET_INTERNAL_URL=https://space-socket.flow-coder.com` ↔ 클라 `NEXT_PUBLIC_SOCKET_URL=https://space-socket.flow-coder.com` = **같은 호스트**.
  - `SOCKET_INTERNAL_SECRET`·`SOCKET_INTERNAL_URL` flowspace-v2 prod에 정상 존재(2h 전 설정).
- **도달성 실측**: LiveKit REST `POST /twirp/livekit.RoomService/ListRooms`→**401**(=endpoint 정상·서명만 없음) / 소켓 도메인→200 / `/internal/enforce` 합성 probe→409(HMAC 통과·postcondition만 거부, 이전 세션).
- **결론: 제어평면(URL/인스턴스/도달성)은 정상.** 근본은 **#2 식별자 불일치** 또는 런타임 상태(stale tile·room/identity·socket presence)로 좁혀짐. 다음 세션은 아래 1·3·4번(런타임 캡처/OCI 로그/4값 정렬)부터.
- ⚠️ **함정(이번 세션 실수)**: `vercel link --yes`가 **flowspace-v2가 아닌 V1 `flowspace` 프로젝트로 재링크**해 env가 다 틀려 보였음. `.vercel/project.json` 정답=`prj_W2Rn0yC3RHdLyqVQpPcvycjDa9Vl`/`flowspace-v2`. **env 작업 후 `.vercel/project.json` projectName 반드시 확인**. `vercel env ls --scope flowcoder`는 링크 무관 동작하나 `env pull`은 링크 따라감. `vercel link`는 `.env.local` 생성+`.gitignore` 수정 부작용(삭제·복원 필요).

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
