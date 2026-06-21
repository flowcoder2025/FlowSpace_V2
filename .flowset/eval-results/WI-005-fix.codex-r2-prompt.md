당신은 독립 적대적 코드 검증자(codex)다. 이전 라운드(r1)에서 당신이 지적한 결함의 **수정 여부**를 read-only로 재검증하고, **출력 스키마에 맞는 JSON만** 반환하라. reviewer="codex", schemaVersion=1, scores/weightedTotal=null. verdict는 P0/P1(fixNow) 잔존 시 FAIL, 경미한 결함만이면 WARNING, 무결하면 PASS.

## r1 지적 → r2 수정 (commit 958ee52, server/handlers/enforce.ts)
1. **[P1] grace 윈도우 권한 잔존**: r1에서 ban/kick이 space:error만 emit하고 250ms 후 disconnect라, 그 사이 socket.data.{spaceId,role,restriction}이 그대로여서 악의적 chat/admin/editor/media 전송이 가능했음.
   → 수정: `applyEnforcement`의 ban/kick 분기에서 각 타겟 소켓에 대해 **동기적으로** `s.leave(spaceId)` + `s.data.spaceId = undefined` + `s.data.role="PARTICIPANT"` + `s.data.restriction="BANNED"` 수행 후, 물리 `disconnect(true)`만 grace(250ms) 후로 미룸. 모든 이벤트 핸들러(chat/party/movement/editor/media/avatar)가 `if (!socket.data.spaceId) return`로 인가하므로 spaceId 무효화로 권한이 즉시 회수됨. 재-join은 WI-001 join 게이트(DB 멤버십·BANNED 재검증)가 차단.
2. **[P2] 다중 탭 player:left 중복**: r1에서 각 소켓 disconnect가 leaveSpace를 호출해 같은 userId의 player:left가 중복 방출.
   → 수정: presence 정리(spacePlayersMap delete + 빈 공간 정리) + `member:kicked` + `player:left`를 **사용자 단위 1회**로 직접 방출. spaceId를 동기 무효화했으므로 지연된 disconnect 핸들러의 leaveSpace는 재실행되지 않음(room.ts disconnect 핸들러는 `if (spaceId)` 가드).
3. **[P3] body limit char vs byte**: r1에서 `raw.length`(문자수)로 4096 비교.
   → 수정: `receivedBytes += (chunk as Buffer).length`로 byte 누적 비교.

## 재검증 관점
- P1 수정이 권한 회수 윈도우를 **완전히** 닫는가? socket.data.spaceId로 인가하지 **않는** 잔존 이벤트 경로가 있는가(예: join:space 재emit → 단 WI-001 게이트가 DB 재검증)? role/restriction 강등이 불필요하거나 누락된 곳은?
- P2 수정이 다중 탭/단일 탭/오프라인(targets=0 early return) 모두에서 player:left·member:kicked를 정확히 1회 보장하고, 지연 disconnect와 경합/중복이 없는가? 타겟이 자기 자신의 member:kicked/player:left를 받지 않는 순서가 맞는가(room leave 먼저)?
- mute/unmute/role 분기는 r1 그대로(disconnect 없음, 캐시 갱신만) — 회귀 없는가?
- 새 수정으로 인한 신규 결함(예: spaceId 무효화 후 leaveSpace 미실행으로 인한 presence 누수, grace 중 동일 유저 재요청)?
- 그 외 r1에서 못 본 결함이 있으면 추가 보고.

대상 파일을 직접 읽고(server/handlers/enforce.ts 전체, 필요 시 server/handlers/room.ts·chat.ts·editor.ts·media.ts의 인가 패턴) 판정하라. 이미 해소된 r1 issue는 다시 올리지 말 것. 잔존/신규만.
