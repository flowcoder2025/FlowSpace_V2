# 설계 협의 — develop → main 승격 실행 전략 (FlowSpace)

당신은 FlowSpace(Next.js 15 + Phaser 3 메타버스, Vercel[웹]+OCI[socket.io] 별 호스트)의 **승격 설계 독립 파트너**다. read-only. 코드를 바꾸지 말고, 아래 승격 실행 전략에 대한 비판·합의·리스크만 산문으로 답하라.

## 배경 (ground truth, 내가 검증함)
- `develop`이 `main`보다 **89커밋 ahead** (WI-001~016 누적). `main`에는 develop에 없는 빈 재배포 트리거 커밋 `38459d5` 1개.
- develop HEAD = `740c4f1`, 작성자 = `flowcoder25 <flowcoder25@gmail.com>` (Vercel 인가 계정).
- **라이브 = 구버전 main + WI-007만.** 즉 WI-001~006/008~016이 이번 승격으로 **처음 라이브**.
- 빌드는 마이그레이션 자동적용 없음: `"build": "prisma generate && next build"` — `migrate deploy` 없음. prod DB 마이그레이션은 전부 수동.
- Vercel prod = `main` 브랜치 자동배포 (작성자가 인가 계정 아니면 배포 실패).
- OCI 소켓 재배포는 `main` push 시 다음 path 변경되면 발동: `server/**`, `protocol/internal/socket-events.ts`, `chat/internal/chat-constants.ts`, `enforce/internal/contract.ts`, `src/lib/auth-secret.ts`, `Dockerfile.socket`, `docker-compose.prod.yml`. 89커밋 diff는 `server/**`(WI-005 enforce webhook, WI-012-1 protocol import 경로)를 건드리므로 **OCI 재배포 확실히 발동**. OCI 배포 = SSH로 `git pull origin main && docker compose -f docker-compose.prod.yml up --build -d`.

## 🔴 최대 go-live 위험 (코드로 확인)
- WI-001이 `src/lib/auth-secret.ts`에 **AUTH_SECRET fail-closed** 도입: `AUTH_SECRET` 미설정 또는 32자 미만이면 즉시 throw.
- 이 헬퍼는 Vercel측 `/api/socket/token`(서명)과 OCI측 `server/middleware/auth`(검증) **양쪽에서 공통 import**.
- `socket-client.ts:41`: `/api/socket/token` 응답 !ok면 즉시 `throw new Error("Failed to get socket token")` — retry/fallback 없음.
- **현재 라이브 main에는 이 fail-closed가 없음.** 승격 즉시 Vercel+OCI 양쪽이 동시에 fail-closed 코드로 교체됨.
- ⇒ prod `AUTH_SECRET`이 **≥32자 + Vercel·OCI 동일값**이면 무중단. 아니면 `/api/socket/token` 500 → 아무도 메타버스 진입 불가(전면 장애).
- 나(Claude)는 Vercel/OCI 대시보드·prod DB 접근 불가 → AUTH_SECRET 실제값/env는 **사용자만 검증 가능**.

## 기타 운영 env (WI-005)
- OCI `.env`에 `SOCKET_INTERNAL_SECRET`(AUTH_SECRET과 다른 값), Vercel에 `SOCKET_INTERNAL_URL`(공개 socket 도메인)+`SOCKET_INTERNAL_SECRET`. 미설정 시 실시간 추방만 degrade(DB는 갱신, 크래시 아님).

## prod 마이그레이션 2건 (수동, 승격과 독립)
- WI-013: `CREATE INDEX "Space_status_updatedAt_id_idx"` + `DROP INDEX "Space_status_idx"`. 대용량이면 direct connection서 `CREATE/DROP INDEX CONCURRENTLY` + `migrate resolve --applied`.
- WI-016: `ADD COLUMN IF NOT EXISTS "isShared"` + `CREATE INDEX IF NOT EXISTS ...`(멱등). prod엔 이미 db push로 isShared 컬럼 존재 추정.
- schema.prisma는 이미 isShared 보유 → 코드는 이미 isShared를 읽음. 인덱스는 성능 전용.

## 내 승격 실행 계획 (초안) — 비판해 달라
1. **env 선확정**: 사용자가 Vercel·OCI 양쪽 AUTH_SECRET(≥32자·동일값) + SOCKET_INTERNAL_* 확인/설정. merge 전 필수.
2. **prod 마이그레이션 적용**(승격과 분리 가능): prod `\d "Space"`/`\d "GeneratedAsset"` 확인 → CONCURRENTLY 적용 → `migrate resolve --applied` → EXPLAIN 검증.
3. **promotion-readiness.md 작성** + 사용자 승인(`promotion-approval.json`).
4. **승격 PR**: develop → main 머지 → Vercel 자동배포 + OCI 자동 재배포 동시 발동 → smoke test(로그인→소켓토큰→메타버스 진입→실시간 동기화).
5. 장애 시 롤백: Vercel 이전 배포 instant rollback + main에 revert 머지(OCI git pull 재빌드).

## 묻는 것
A. **시퀀싱**: env 선확정 → migration → merge → smoke 순서가 옳은가? 특히 마이그레이션을 merge 전/후 어디에? (코드가 인덱스/컬럼에 런타임 의존하지 않으면 분리 가능하다고 본다 — 동의?)
B. **AUTH_SECRET 리스크**: merge 전에 prod AUTH_SECRET 정합을 사용자가 어떻게 무중단으로 확정 검증해야 하나? Vercel·OCI 값이 이미 같다는 보장이 없을 때 안전한 검증 절차는? (merge 후 장애를 피하는 dry-run/사전검증 방법)
C. **롤백 적정성**: Vercel instant rollback + main revert(OCI 재빌드)로 충분한가? OCI docker `up --build` 실패 시 이전 이미지로 회귀하는 보강이 필요한가?
D. **마이그레이션 안전성**: WI-013 `DROP INDEX "Space_status_idx"`가 비-CONCURRENTLY로 prod에 가면 위험한가? 소규모 가정 시 일반 migrate deploy 무방 판단의 전제는?
E. **89커밋 일괄 승격 vs 분할**: 인증·소켓·DB가 한 번에 라이브되는데, 단일 빅뱅 승격이 맞나 아니면 위험순 분할 승격이 맞나?
F. **내가 놓친 위험 1가지**.

각 항목 간결하게. 합의/반대 명확히.
