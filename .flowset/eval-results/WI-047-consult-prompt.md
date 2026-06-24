# 설계 협의 — 멤버 강퇴(kick)가 라이브에서 무력화되는 근본결함 수정 (WI-047 후보)

너는 FlowSpace(Next.js 15 + socket.io + LiveKit 메타버스)의 시니어 설계 리뷰어다. 아래는 **근본원인이 이미 실측 확정**된 결함이고, 수정 방향도 큰 틀은 사용자 승인을 받았다. 나는 구현 직전이며, **세부 설계 결정 2~3개를 너와 협의**하려 한다. 산문으로 답하라. 마지막에 "내가 놓칠 위험 1가지"를 반드시 포함하라.

## 인프라 전제 (실측 확정)
- 소켓 서버 = OCI **단일 인스턴스**, **Redis 없음**(in-memory state 가능).
- Next.js API = Vercel(별도 프로세스). 소켓 서버(OCI)와 **공유 상태는 prod DB(Supabase)뿐**.
- 크로스프로세스 제재 채널: Next API → HMAC 서명 `POST /internal/enforce` → 소켓 서버. (action: ban/kick/mute/unmute/role/archive)
- prod DB 마이그레이션 = **사용자 승인 게이트**(Supabase 직결 IPv6 전용 전환됨 → `prisma migrate deploy` 불가, pooler `$executeRaw` 멱등 DDL로 우회하는 무거운 절차). 즉 **컬럼 추가는 비용이 있다.**
- LiveKit = OCI 자체호스팅. 토큰 발급은 Vercel `POST /api/livekit/token`.

## 확정된 근본원인 (S2 조사 + 내 코드 재검증)
현재 kick 동작 (`PATCH /api/spaces/[id]/admin/members` action="kick"):
1. `SpaceEventLog` 기록 + `dispatchEnforcement({action:"kick"})`(소켓 disconnect) + `removeSpaceParticipant`(LiveKit 화상 제거). **`SpaceMember` DB는 무변경**(restriction은 NONE 유지 — kick은 차단이 아니라 임시 퇴장).
2. 소켓 서버 `applyEnforcement`(kick): 대상 소켓에 `space:error{code:"KICKED"}` emit → `detachSocketFromSpace`(room 이탈+socket.data 무효화) → 250ms 후 `socket.disconnect(true)` → `member:kicked`+`removeUserPresence`.

**왜 즉시 복귀하나 (확정):**
- 서버 `disconnect(true)` → 클라 reason="io server disconnect" → socket.io는 자동재연결 **안 함**(맞음).
- 그러나 클라 `useSocket` effect(deps `[spaceId,userId,nickname,avatar]`)가 **리마운트/deps 변경/pagehide·beforeunload cleanup→재실행**되면 `getSocketClient()`가 죽은 싱글턴(`connected=false && active=false`)을 보고 **새 소켓을 생성** → "connect" 이벤트에서 **`join:space` 자동 재발송**(`use-socket.ts:301`) → DB상 여전히 유효 멤버(restriction NONE) → **즉시 재입장**.
- 재연결 핸들러(`use-socket.ts:320-326`)도 동일하게 join:space 재발송.
- 즉 **kick은 DB에 아무 흔적을 안 남겨서, 어떤 경로로든 소켓이 재생성되면 join 게이트(room.ts)를 그냥 통과**한다. 이게 핵심.

mute/ban은 DB(restriction)를 바꾸므로 재입장 시 게이트가 막는다(ban) / 캐시가 복원된다(mute) — **kick만 DB 무변경이라 무력**.

## 사용자 승인 수정 방향 (큰 틀)
- **kick = 서버 쿨다운 + 클라, 둘 다.**
  - 서버: `kickedUntil`(예 ~30s) 상태 → 그 기간 `join:space`·(가능하면)LiveKit 토큰 거부. BANNED(영구 restriction)와 **분리**.
  - 클라: `space:error{code:"KICKED"}` 수신 시 그 공간 자동재연결 중단 + `/my-spaces` 이동.
- 서버 게이트가 핵심 — 클라만 고치면 악성/구버전 번들에 뚫림.

## 관련 코드 실측 (현재 상태)
- `room.ts` `join:space` 게이트: `Space.status===ACTIVE` + `SpaceMember` 존재 + `restriction!==BANNED` + archivedSpaces deny-cache(in-memory). 통과 시 `socket.join`.
- `enforce.ts` kick postcondition: `member!==null && member.restriction!=="BANNED"` (WI-045 — kick은 멤버 삭제 안 하므로 유효 멤버 확인).
- `livekit/token/route.ts`: `restriction==="BANNED"` → 403. (그 외 토큰 발급, TTL 4h)
- `SpaceMember` 스키마: 이미 `restrictedUntil DateTime?` 컬럼 존재하나 **enforce/소켓에서 전혀 안 읽음**(비-admin members route가 set만 하는 휴면 필드). restriction enum(NONE/MUTED/BANNED)만 게이트에 사용.
- 클라 소켓: 싱글턴(`socket-client.ts`) + `getSocketClient()`가 `connected||active`면 재사용. effect cleanup이 매번 `disconnectSocket()`.

## 협의 질문

**Q1 (핵심) — 쿨다운 저장소.** 두 안의 트레이드오프를 평가하고 추천하라:
- (A) **소켓 서버 in-memory** `Map<"${spaceId}:${userId}", expiryMs>`: 마이그레이션 불요·단순·빠름. 단 (a)Vercel LiveKit 토큰 라우트에서 **읽을 수 없음**(별 프로세스), (b)서버 재시작 시 소실(단 kick은 ~30s 임시라 재시작=재입장 허용은 kick 시맨틱과 무모순), (c)enforce 웹훅 도달에 의존(dispatch 실패 시 미설정).
- (B) **DB 컬럼** `kickedUntil DateTime?`(신규, restrictedUntil 재사용 말고): join:space·LiveKit 토큰 **양쪽 게이트 가능**·재시작 생존·PATCH 라우트에서 enforce와 원자적으로 set. 단 **prod 마이그레이션 사용자 게이트**(비용 있음).
어느 쪽을 추천하나? 판단 근거는?

**Q2 — LiveKit 토큰 게이팅이 실제로 필요/유효한가?** kick은 이미 `removeSpaceParticipant`로 화상 타일을 지금 제거한다. 토큰 게이트는 **신규 발급만** 막을 뿐, 구버전 클라의 LiveKit JS SDK가 **기존 4h 토큰으로 room 자동재연결**하는 건 못 막는다(removeParticipant 후 SDK 재합류). 그렇다면 토큰 게이팅은 (소켓 쿨다운+클라 navigate-away 대비) 한계효용이 낮은가? 이게 낮다면 Q1에서 in-memory(A)로 충분해지고 마이그레이션을 피할 수 있다 — 이 연결을 평가하라.

**Q3 — 쿨다운 set 위치 + kick postcondition.** DB안이면 PATCH 라우트에서 kick 시 `kickedUntil` set + enforce dispatch(원자성?). in-memory안이면 `applyEnforcement`에서 set(대상 소켓 0개여도 set해야 하나? 현재 `targets.length===0 → return 0` 조기반환 전에 set?). enforce kick postcondition(`member!==null && !BANNED`)은 그대로 둘까, kickedUntil 확인을 추가할까?

**Q4 — 클라 "재연결 중단" 메커니즘.** 싱글턴 소켓 + effect가 리마운트/deps 변경마다 소켓 재생성하는 구조에서, `KICKED` 수신 후 그 공간 join을 어떻게 확실히 막나? 모듈/ref 레벨 "kicked space" 가드로 `getSocketClient`/join:space 재발송 차단? navigate(`/my-spaces`) 자체가 또 다른 cleanup→reconnect 루프를 트리거하지 않게 하려면? kick(임시·재입장 가능)과 ban/archive(navigate away지만 영구)의 클라 처리 차이는?

**Q5 — 스코프.** 이 WI에 **재연결 루프 증폭기**(pagehide/beforeunload가 항상 leave+disconnect, effect deps 변경 시 remount)도 같이 손대야 하나, 아니면 kick에 집중하고 루프는 분리하나? 조사에선 이 루프가 voice-404 stale-tile·ban "새로고침 필요"의 증폭기로 지목됨. 스코프 크리프 vs 근본 증폭기 방치의 트레이드오프.

**Q6 — mute/ban 검증.** mute/ban은 코드상 정상일 가능성이 높으나 WI-045 승격 후 라이브 미검증. 이 WI에서 mute/ban에 손댈 코드 이유가 있나, 아니면 순수 라이브 검증 사항인가?

**그리고: 내가 놓칠 위험 1가지** — 위 수정에서 내가 가장 놓치기 쉬운 함정 하나.
