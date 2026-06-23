# 승격 Readiness — WI-026/033/034/035/036/037/038/039/041 develop→main (2026-06-23)

## 결과: ✅ GO → 승격 완료·라이브 반영

- **PR#44 rebase merge** → main HEAD `150428d` (author=`flowcoder25@gmail.com` 보존 → Vercel 인가)
- **prod DB**: `Space.deletedBy` 마이그레이션 적용 (col BEFORE=false → AFTER=true·`_prisma_migrations` 기록·checksum 검증)
- **OCI 소켓**: develop SHA 선배포(역호환) → main 머지 후 clean main 정렬, 컨테이너 healthy(새 이미지 `91d1622f`·WI-036 archive 코드)
- **Vercel Production ● Ready** (`flowspace-v2-42jofa0l4-flowcoder`, main push 직후)
- **라이브 스모크**: web `/` 200·`/login` 200·`/api/users/me` 307 / socket auth probe **connect 성공**(sid=aBPTiO6fr2·AUTH_SECRET 44자≥32·새 OCI 코드 인증 수락)
- **develop back-sync 완료** (develop == main == `150428d`)

## 승격 델타 (9건)
직전 승격(PR#34 = WI-029~032) 이후:
| WI | 내용 | 듀얼검증 |
|---|---|---|
| WI-026-fix | 저장 metadata public/internal 분리 | codex PASS(5R)·eval 9.92 |
| WI-033-feat | 어드민 대시보드 한글화 + copy SoT | codex PASS·eval 9.88 |
| WI-034-fix | 인-스페이스 role 전달 | codex PASS(3R)·eval 9.94 |
| WI-035-feat | 참가자 패널 멤버관리 UI | codex PASS(2R)·eval 9.88 |
| WI-036-fix | 스페이스 archive 하드닝(deletedBy + 추방) | codex WARNING(환경P3)·eval 9.81 |
| WI-037-feat | 설정 화면 스페이스 삭제 UI | codex PASS(2R)·eval 9.9 |
| WI-038-feat | LiveKit moderator mute 서버 계약 | codex WARNING(2R)·eval 9.88 |
| WI-039-feat | 인-스페이스 음성 강제 음소거 UI | codex WARNING·eval 9.77 |
| WI-041-fix | 설정 편집 권한 정합(STAFF 읽기전용) | codex PASS·eval 9.83 |

## Readiness 판정 (codex 조건부 GO)
- **코드 정합성: GO** — role SoT가 `SpaceMember.role`로 일관(WI-034 주입 ↔ WI-035 멤버관리 ↔ WI-038/039 음성 ↔ WI-041 설정 게이트 동일 계층 규칙). STAFF는 읽기/관리 화면 가능하나 설정 편집·삭제는 owner/superAdmin. enforce HMAC·postcondition 재확인·응답 allowlist·deletedBy 미노출 sound.
- **핵심 위험 적출(codex)**: 직전 권고 순서 `prod DB→main→OCI`는 NO-GO 근접 — 구 OCI는 `archive` enforce action을 하위호환 무시 안 하고 400 거부(구 contract=ban/kick/mute/unmute/role·userId 필수). 새 Vercel이 archive 보내면 구 OCI 거부 → DELETE는 성공(DB ARCHIVED·신규 join 차단)이나 **접속자 추방/detach/purge 누락**. → **OCI 선배포(역호환)로 창 차단**: 새 OCI는 구·신 enforce action 모두 처리.
- **적용 순서(안전)**: prod DB → **OCI 선배포(develop SHA·healthy 확인)** → main rebase 머지 → Vercel 확인 → 스모크 → back-sync.

## 배포 영향 (실측)
- **server/ 변경(WI-036만)**: `enforce.ts`(+55)·`room.ts`(+46) — archive 추방/detach/deny-cache. → OCI 재배포(선배포 완료).
- **prisma/ 변경(WI-036만)**: `Space.deletedBy` 마이그레이션. → prod DB 적용 완료.
- 나머지 8 WI = Vercel 웹/API.
- 신규 env 0. Dockerfile.socket COPY 변경 없음.

## 인프라 변화·함정 (이번 승격 신규)
- **🔴 Supabase 직결(5432) IPv4 폐기 → IPv6 전용**: `prisma migrate deploy`(directUrl 5432) P1001 불가. 직전 승격(PR#34/PR#18)에선 작동했음. → **우회: transaction pooler(6543·DATABASE_URL)로 `@prisma/client $executeRaw` 멱등 DDL 직접 적용 + `_prisma_migrations` 기록**(기존 3개 마이그레이션 checksum을 로컬 파일 sha256과 대조해 알고리즘 검증 후 삽입). 향후 마이그레이션도 이 경로.
- **OCI 자동배포 detached HEAD 충돌**: OCI 선배포 위해 `git checkout <develop-SHA>`(detached) 후 build/deploy → main push 자동배포가 detached HEAD에서 `git pull origin main` 시 `set -e`로 조기 실패(컨테이너 미변경=안전). → main 머지 후 `git checkout main && git reset --hard origin/main`로 정리 + workflow_dispatch로 CD 정상 재확인.

## ✅ SOCKET_INTERNAL 활성화 완료 (2026-06-24, 승격 후속)
실시간 제재(WI-005)+archive 즉시추방(WI-036)을 prod에서 활성화. **Vercel CLI 현 계정 `flowcoder25-1055`이 이미 FlowCoder 팀 env 쓰기 권한 보유 → 재인증 불요**(사용자가 인증 제안했으나 권한 테스트로 불필요 확인).
- **Vercel**(`--scope flowcoder`): `SOCKET_INTERNAL_URL`=`https://space-socket.flow-coder.com` + `SOCKET_INTERNAL_SECRET`(64hex 랜덤) 추가 → `vercel redeploy`(새 env 주입, 배포 `ed12391rj` ● Ready, `space.flow-coder.com` alias).
- **OCI** `~/flowspace-v2/.env`: 동일 `SOCKET_INTERNAL_SECRET` 추가(`.env.bak-preenforce` 백업) → 소켓 컨테이너 재생성(`env_file: .env` 런타임 주입, no rebuild). 기동 로그 degrade 경고 사라짐 = enforce ACTIVE.
- **검증(합성 enforce probe)**: 존재하지 않는 spaceId archive 요청을 유효 HMAC(SHA256·`timestamp.body`)로 서명→`POST /internal/enforce` → **409 Postcondition not met**(HMAC 통과=시크릿 일치·fake space 무영향). 대조로 틀린 시크릿→**403 Invalid signature**(검증 실동작 확인).

## 🟡 잔여 사용자 게이트 (비차단)
- **인증 archive/mute e2e 심층 스모크**: 실제 로그인→입장→삭제/mute→접속자가 `SPACE_ARCHIVED` 받고 끊기는지·moderator mute 적용 관측은 자격증명+다중 클라이언트 필요(codex: HTTP 200만 보면 안 됨). **이제 enforce 활성이라 실제 추방까지 작동 예상** — 사용자 라이브 검증만 남음.

## 롤백
- Vercel: 이전 배포 promote (`flowspace-v2-...` 직전 Ready).
- OCI: `flowspace-v2_socket:rollback-pre-promo` 이미지로 복귀.
- main: revert PR.
