당신은 독립 적대적 코드 검증자(codex)다. 이전 라운드(r2)에서 당신이 지적한 결함의 **수정 여부**를 read-only로 재검증하고, **출력 스키마에 맞는 JSON만** 반환하라. reviewer="codex", schemaVersion=1, scores/weightedTotal=null. verdict는 P0/P1(fixNow) 잔존 시 FAIL, 경미한 결함만이면 WARNING, 무결하면 PASS.

## r2 지적 → r3 수정 (commit e8e714c; server/handlers/room.ts + enforce.ts)
1. **[P1-a] 파티 room 잔존**: r2에서 ban/kick이 공간 room만 떠나고 `party-${spaceId}-${partyId}`에는 남아 grace(250ms) 동안 파티 메시지 수신이 가능했음.
   → 수정: 신규 `detachSocketFromSpace(socket)`가 `[...socket.rooms]`에서 자기 id 제외 **모든 room**(공간+파티) 이탈 + `socket.data`(spaceId/partyId/partyName/role/restriction/memberId) 무효화. enforce ban/kick이 각 타겟 소켓에 대해 호출.
2. **[P1-b] leave 경로 stale 인가**: r2에서 `leave:space`가 클라이언트 spaceId를 신뢰, `leaveSpace`가 socket.data를 안 비워 퇴장 후에도 stale 인가가 남음.
   → 수정: `leave:space` 핸들러가 `socket.data.spaceId`만 사용(클라 인자 무시). `leaveSpace = removeUserPresence(io, spaceId, userId) + detachSocketFromSpace(socket)`. `removeUserPresence`는 presence delete + `player:left`를 사용자 단위 1회.

## 구조 (재검증 대상)
- `room.ts`: `detachSocketFromSpace`(소켓 분리), `removeUserPresence`(사용자 presence 정리), `leaveSpace`(둘 조합) export. `leave:space`/`disconnect` 핸들러는 `socket.data.spaceId` 사용.
- `enforce.ts` ban/kick: 각 타겟 `s.emit(space:error)` → `detachSocketFromSpace(s)` → grace 후 `disconnect(true)`. 루프 후 `member:kicked` 1회 + `removeUserPresence` 1회.

## 재검증 관점
- P1-a: 파티 room 포함 모든 application room이 동기 이탈되는가? `socket.rooms` 스냅샷(`[...]`) 복사로 순회 중 mutation 안전한가? partyId 등 잔존 상태 없는가?
- P1-b: `leave:space`가 클라 spaceId를 완전히 무시하는가? 정상 퇴장 후 socket.data가 비워져 stale chat/admin/editor/media가 차단되는가? 지연 disconnect 시 socket.data.spaceId=undefined로 leaveSpace 재실행/중복 player:left가 없는가?
- 다중 탭/단일 탭/오프라인(targets=0 early return) 각각 player:left·member:kicked 정확히 1회인가? 타겟이 자기 알림 미수신(detach 먼저, broadcast 나중) 순서가 맞는가?
- 신규 helper 분리로 인한 회귀: 정상 disconnect 경로(leaveSpace)가 기존과 동치인가? mute/unmute/role 분기 회귀 없는가?
- 그 외 잔존/신규 결함.

대상 파일을 직접 읽고(server/handlers/room.ts·enforce.ts 전체, 필요 시 party.ts/chat.ts 인가 패턴) 판정하라. 이미 해소된 issue는 다시 올리지 말 것. 잔존/신규만. 무결하면 PASS.
