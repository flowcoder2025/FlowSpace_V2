너는 FlowSpace(Next.js 15 + LiveKit + 별 socket.io 서버[OCI]) 독립 블라인드 코드 검증자(codex)다. ACTIVE WI 구현을 read-only로 적대 검증하고 출력 스키마 JSON 하나만 최종 메시지로 내라(verdict PASS|WARNING|FAIL, issues P0~P3). evaluator 산출물 절대 참조 금지(상호 블라인드).

## WI-045-feat 범위 (impl 66d3b19, develop 분기)
**사용자 라이브 제보 결함 3건**(강퇴/차단 반-구현): ①kick이 `prisma.spaceMember.delete`로 멤버 삭제 → `room.ts` join 게이트 `!member→거부`에 걸려 재입장 불가("재입장 가능" 안내 거짓) ②kick/ban이 LiveKit 화상 참가자 미제거(서버 enforce는 소켓만 detach+disconnect) → 카메라 타일 잔존 ③unban(차단 해제) UI/액션 없음 → 운영자 복원 불가.

**확정 모델(설계 codex consult)**: kick=현재 세션만 강제 퇴장·재입장 허용 / ban=영구+해제(unban) / 둘 다 LiveKit 화상 제거.

**해소**:
1. `server/handlers/enforce.ts`: kick postcondition `member === null`(삭제 확인) → `member !== null && member.restriction !== "BANNED"`(유효 멤버 확인 — 삭제 안 하므로). **OCI 소켓 서버 재배포 필요.**
2. `src/app/api/spaces/[id]/admin/members/route.ts`(PATCH): (a) kick: `prisma.spaceMember.delete` 제거(멤버 유지) + enforce kick(소켓) + `removeSpaceParticipant`(LiveKit). (b) ban: restriction=BANNED + enforce + `removeSpaceParticipant` 추가. (c) unban 신규 action: restriction=NONE, **enforce 미발송**(`actionLabel !== "unban"` 가드 — 차단 유저 오프라인). body action 타입에 unban 추가.
3. 신규 `src/features/space/livekit-moderation/internal/eviction.ts`: `resolveLiveKitConfig`(moderate 라우트서 추출·공용화) + `removeSpaceParticipant(spaceId, userId)` best-effort(미설정→not_configured·throw→remove_failed·둘 다 throw 안 함·로깅). moderate 라우트는 로컬 config 제거하고 공용 import.
4. `member-actions-menu.tsx`: `isBanned`면 "차단 해제"(unban)만 노출(mute/kick/ban/음성 숨김). RestrictAction에 unban 추가. `showVoiceActions = !!participantIdentity && !isBanned`.
5. `space-copy.ts`: actions.unban="차단 해제".

**변경 파일**: server/enforce.ts, admin/members route(+test), moderate route, member-actions-menu(+test), space-copy, livekit-moderation index, eviction.ts(+test).

## 적대 검증 관점
- **kick 재입장 정합**: 멤버 삭제 안 하니 room.ts `!member` 게이트 통과 → 재입장 됨? restriction 무변경(NONE)이라 BANNED 게이트도 안 걸림? "io server disconnect" 후 자동 재접속 안 함(수동 재입장)?
- **enforce postcondition 보안**: kick postcondition `member!==null && !BANNED`로 완화 — HMAC 유출 시 유효 멤버를 반복 disconnect 가능하나 권한검증은 라우트(canActOn). 이 완화가 과도한가? ban/mute/unmute/role postcondition 무변경 확인.
- **unban DB-only 정합**: enforce 미발송 가드(`!== "unban"`)가 정확? unban이 ENFORCE_USER_ACTIONS 미포함인데 dispatch 타면 타입/런타임 에러 — 가드로 차단됨? actionLabel narrowing tsc 통과?
- **LiveKit removeParticipant best-effort**: 미설정/미접속/throw 모두 admin 액션 실패시키지 않음? kick은 소켓 enforce가 근본이고 LiveKit은 보강이라는 분리 정확? identity=`user-${userId}`·room=`space-${spaceId}` 정확?
- **menu banned 게이트**: BANNED 멤버에 mute/kick/ban/음성 숨기고 unban만? 일반 멤버는 기존 set 보존? unban은 확인 다이얼로그 없이 직접 액션(복원이라)?
- **회귀**: 기존 mute/unmute/changeRole/ban 동작·응답 allowlist(WI-014)·moderate 음성(config 추출 후)·식별자(memberId만 PATCH) 무회귀? 멤버 게이팅(canActOn/owner 보호) 보존?
- **범위**: prisma/ 무변경(restriction enum 기존)=마이그레이션 불요 맞나? esbuild src 입력 불변(enforce.ts 새 import 없음)=OCI COPY 완전?

## 기계 게이트(권위 환경)
tsc0 / eslint 0 errors(선재 LiveKit 경고1·WI무관) / vitest 563→575(+12) 전부 통과 / next build0 / esbuild server 번들0(src 입력 4개 불변). read-only 샌드박스면 vitest spawn EPERM은 환경제약(P3)이지 결함 아님.
