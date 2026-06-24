# 블라인드 적대 검증 — WI-047-fix 강퇴(kick) 쿨다운

너는 독립 적대 리뷰어다. 아래 변경을 **블라인드로** 검증하라(다른 검증자 산출물 참조 금지). 출력은 강제된 JSON 스키마(reviewer="codex", verdict=PASS|WARNING|FAIL, issues P0~P3 + defer/deferRationale/fixNow)를 따른다. **권위 판정은 마지막 agent_message JSON 하나**다.

## 변경 범위 (git diff: `git diff develop...HEAD`, base=develop)
HEAD = `72af3e5`. 변경 파일을 직접 읽고 검증하라:
- `src/lib/kick-cooldown.ts` (신규) + `.test.ts`
- `server/handlers/room.ts` (kick 쿨다운 맵 + join:space 게이트)
- `server/handlers/enforce.ts` (kick 적용 시 markUserKicked)
- `src/features/space/socket/internal/kick-guard.ts` (신규) + `.test.ts`
- `src/features/space/socket/internal/use-socket.ts` (connect/reconnect 가드 + space:error KICKED) + `.test.ts`
- `src/features/space/bridge/internal/use-socket-bridge.ts` (onKicked 배선)
- `src/app/space/[id]/space-client.tsx` (useRouter + onKicked)
- `src/constants/space-copy.ts` (SOCKET.kickedCooldown 카피)
- `Dockerfile.socket` + `.github/workflows/deploy-socket.yml` (kick-cooldown.ts COPY/경로)

## 해결한 근본원인 (확정)
강퇴(kick)는 `SpaceMember` DB를 바꾸지 않는다(restriction=NONE 유지 — "임시 퇴장"). 따라서 소켓 `disconnect(true)`(reason="io server disconnect", socket.io 자동재연결 안 함) 후에도, 클라 `useSocket` effect가 리마운트/deps 변경/pagehide·beforeunload cleanup으로 재실행되면 `getSocketClient()`가 죽은 싱글턴을 보고 **새 소켓을 생성** → "connect"에서 `join:space` 자동 재발송 → DB상 유효 멤버라 **즉시 복귀**. 재연결 핸들러도 동일. WI-045 후에도 잔존한 확정 결함.

## 설계 결정 (codex consult 1R 수렴 반영)
- **저장소 = 소켓 서버 in-memory**(DB 컬럼/마이그레이션 회피). 근거: 핵심 게이트가 join:space(OCI 소켓 서버 내부)이고 단일 OCI·Redis 없음, kick은 ~30s 임시라 재시작 소실 무모순. LiveKit 토큰 게이팅은 기존 4h 토큰 재사용을 못 막아 한계효용 낮아 제외.
- **최종 강제력 = 서버 join:space 쿨다운**(클라 가드는 UX 보조 — 다중 탭은 클라 메모리 비공유). 이게 핵심 안전 속성.
- `applyEnforcement`에서 kick 시 대상 소켓 조회/early-return **전에** `markUserKicked` 호출(오프라인/다른 탭 즉시 재진입 차단).
- enforce kick postcondition은 현행 유지(`member!==null && !BANNED`) — 쿨다운 검증을 섞지 않음.
- 클라: `space:error{code:"KICKED"}` 수신 → `markSpaceKicked`(가드) + `onKicked`(/my-spaces). connect/reconnect의 join 발송 직전 `isSpaceKicked` 차단.
- mute/ban 코드 무변경(DB 게이트 정상) — 라이브 검증 사항.

## 검증 관점 (적대적으로)
1. **안전 속성**: 강퇴된 유저가 쿨다운 동안 어떤 경로(새 소켓·재연결·다른 탭·오프라인 후 재진입·구버전 번들)로도 join:space를 통과해 복귀할 수 있나? 서버 게이트가 진짜 최종 방어인가?
2. **회귀**: 정상 멤버(비-강퇴)의 입장/재연결이 막히지 않나? mute/ban/archive/role enforce 경로 무손상? `isUserKicked` 조기 거부가 BANNED/NOT_MEMBER/archive 게이트 순서와 충돌 없나?
3. **쿨다운 정확성**: 만료 경계(now>=until), lazy 삭제, 재-kick 연장, 키 충돌(spaceId:userId 구분자), 누수.
4. **클라 생명주기**: connect/reconnect 가드가 정상 흐름을 깨지 않나? KICKED 후 navigate가 또 다른 reconnect 루프를 유발하나? onKickedRef stale closure? React effect cleanup 상호작용? 다중 탭에서 클라 가드 비공유가 서버 게이트로 커버되나?
5. **번들/배포**: esbuild 런타임 src 입력(5개: chat-constants·enforce contract·auth-secret·socket-startup·kick-cooldown)이 Dockerfile.socket COPY와 일치하나? kick-cooldown.ts가 React/node-fs 의존 없어 서버 번들 안전한가?
6. **하드코딩/카피/경계**: 영문 누출, 모듈 경계(internal 직접 import), 하드코딩 상수.
7. **테스트 품질**: 신규 테스트가 false-pass(가드 무력화해도 통과)인가? 변이검증 가치 있나?

**내가 놓쳤을 수 있는 결함 1가지**도 반드시 지목하라. P0/P1은 fixNow=true, 환경적/사소한 건 defer=true + deferRationale.
