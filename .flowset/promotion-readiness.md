# Promotion Readiness — develop → main (WI-001 ~ WI-016)

> process 07 step 2 산출물. 작성일 2026-06-22. 작성자 Claude(메인) + Codex 설계 협의 + 승격 전용 적대 검증 워크플로우(19 에이전트).
> **상태: 코드 준비 완료(READY). 머지 실행은 아래 "운영 사전조건"을 사용자가 충족·승인해야 함(process 07 step 3 `promotion-approval.json`).**

---

## 1. 변경 요약

- **범위**: `develop`(HEAD `740c4f1`)가 `main`보다 **+89커밋** ahead. 누적 WI-001 ~ WI-016.
- **라이브 현황**: 현재 main 라이브 = 구버전 + WI-007만. 이번 승격으로 WI-001~006 / WI-008~016이 **처음 라이브**.
- **main 분기**: main에 develop엔 없는 빈 재배포 커밋 `38459d5`(author=flowcoder25) 1개 존재 → 단순 fast-forward 아님.

| WI | 종류 | 라이브 영향 요지 |
|----|------|------|
| WI-001 | 보안 | 인증/인가 우회 8건 차단 + **AUTH_SECRET fail-closed**(🔴 최대 go-live 위험, 아래 4.1) |
| WI-002 | 안정성 | Phaser 씬 생명주기 cleanup 누수 |
| WI-003 | 경계 | 모듈 internal import 캡슐화(런타임 무영향) |
| WI-004 | 보안 | `DELETE /api/assets/[id]` path traversal 차단 |
| WI-005 | 보안 | 실시간 제재(ban/kick/mute/role) 크로스프로세스 추방 — **신규 env `SOCKET_INTERNAL_*` 필요**(아래 4.2) |
| WI-006 | 안정성 | useScreenRecorder onerror Promise 종결 |
| WI-008 | 정리 | 슈퍼어드민 부트스트랩 인자 검증 + 403 code |
| WI-009 | 접근제어 | 슈퍼어드민 전역 스페이스 뷰 + **`inviteCode` 목록 응답 제거**(API 계약 변경, 아래 4.4) |
| WI-010 | 성능 | `GET /api/spaces` cursor 페이지네이션 — **응답에 `nextCursor`/`hasMore` 추가**(하위호환: `spaces` 유지) |
| WI-011 | 테스트 | API 라우트 테스트 하니스(런타임 무영향) |
| WI-012-1/2 | 경계 | protocol 계약 모듈 분리 + Dockerfile.socket COPY 보강(런타임 동작 무변) |
| WI-013 | 성능 | Space 복합 인덱스 마이그레이션(**prod 수동 적용, 성능 게이트**, 아래 4.3) |
| WI-014 | 보안 | API 응답 select allowlist 정형화(민감 필드 미반환) |
| WI-015 | 안정성 | Phaser tween 생명주기 누수(killTweensOf) |
| WI-016 | chore | `GeneratedAsset.isShared` 마이그레이션 베이스라인(**go-live 게이트=컬럼 존재**, 아래 4.3) |

> `.flowset/eval-results/*` 원장·`.claude/*` 문서가 268 변경파일의 대부분(런타임 무관). 실제 런타임 코드 표면: `server/**`, `src/**`, `prisma/**`, `Dockerfile.socket`, `.github/workflows/**`, `scripts/set-super-admin.mjs`.

---

## 2. 게이트 결과 (ground truth, 2026-06-22 develop HEAD `740c4f1` 실측)

| 게이트 | 결과 | 근거 |
|--------|------|------|
| tsc `--noEmit` | ✅ 0 | 이번 세션 실측 |
| vitest | ✅ 165/165 (17 파일) | 이번 세션 실측 |
| next build | ✅ 0 | 이번 세션 실측 |
| eslint | ⚠️ 경고 1 (선재) | `LiveKitMediaContext.tsx:578` Unused eslint-disable directive. WI 무관·선재. CI의 `eslint .`(기본=경고 시 exit 0) **통과**. `--max-warnings 0` 기준만 exit 1 |
| **OCI 소켓 esbuild 번들** | ✅ 0 | `esbuild server/index.ts --bundle ...` EXIT 0. **번들 런타임 src 입력 3개(auth-secret·chat-constants·enforce contract) ⊆ Dockerfile.socket COPY 4개** → COPY 완전성 metafile 실증 → OCI 재빌드 성공 보장 |
| WI별 듀얼검증(.pass) | ✅ 16/16 | `.flowset/eval-results/*.pass` 전부 존재(WI-001~016) |

**승격 차단 코드 결함 = 0건.** 적대 검증 워크플로우(env 완전성·마이그레이션 런타임 의존·승격특정 동작변화·배포 파이프라인 4개 렌즈 + P0/P1 반증)에서 발굴된 모든 실 항목은 **운영 사전조건**(env/마이그레이션/머지 전략)이며 코드 수정 대상이 아님. 감사가 올린 "main에 신규파일 없음→장애"류는 승격의 목적 그 자체로 false-positive(반증됨).

---

## 3. 배포 파이프라인 (승격 시 자동 발동)

승격 = develop→main 머지 → **두 배포가 동시 발동**:

1. **Vercel(웹)**: main 브랜치 push 자동배포. ⚠️ **main HEAD 커밋 author가 Vercel 인가 계정(`flowcoder25@gmail.com`)이어야 배포 성공**(WI-007 때 인가 아닌 author로 1회 실패 선례).
2. **OCI(socket.io)**: `.github/workflows/deploy-socket.yml`이 main push + 트리거 path 변경 시 SSH 배포(`git pull origin main && docker compose -f docker-compose.prod.yml up --build -d` @144.24.72.143). 이번 diff는 `server/**`·`auth-secret.ts`·`Dockerfile.socket`·`protocol/socket-events.ts`·`chat-constants.ts`·`enforce/contract.ts`를 건드림 → **OCI 재배포 확실히 발동**(검증 워크플로우 CONFIRMED). 빌드 실패 시 기존 컨테이너 유지(즉시 장애 아님).

---

## 4. 리스크 & 운영 사전조건 (🔴 = go-live 게이트)

### 4.1 🔴 AUTH_SECRET 정합 — 최대 위험
- WI-001이 `src/lib/auth-secret.ts`에 fail-closed 도입: `AUTH_SECRET` 미설정/32자 미만 시 즉시 throw. Vercel `/api/socket/token`(서명)·OCI `server/middleware/auth`(검증) **양쪽 공통**. `socket-client.ts:41`은 토큰 실패 시 즉시 throw(폴백 없음).
- **현재 라이브 main엔 이 fail-closed 없음** → 승격으로 처음 적용.
- **게이트**: prod `AUTH_SECRET`이 **≥32자 + Vercel·OCI 동일값**이어야 무중단. 아니면 `/api/socket/token` 500 → **아무도 메타버스 진입 불가(전면 장애)**.
- **검증법(Codex 협의)**: 값 노출 없이 **fingerprint 비교** — Vercel prod env와 OCI `.env`에서 각각 `AUTH_SECRET`의 **길이 + SHA-256 앞 8자리**만 출력해 일치 확인. 원문은 로그/채팅에 남기지 말 것.
- ⚠️ `AUTH_SECRET`은 NextAuth 세션 서명에도 쓰임 → **새 값으로 교체 시 기존 로그인 세션 전부 무효화(로그아웃, 장애 아님)** → 교체가 필요하면 maintenance window에서.
- **권장 dry-run**: Vercel preview/staging + 임시 OCI socket 컨테이너에 동일 secret으로 `로그인→/api/socket/token→socket auth` end-to-end 통과 확인(prod merge 없이).

### 4.2 SOCKET_INTERNAL_* — 실시간 제재 (degrade, 장애 아님)
- WI-005 신규 env 2종:
  - **OCI `.env`**: `SOCKET_INTERNAL_SECRET`(AUTH_SECRET과 **다른** 값, enforce 요청 HMAC 검증).
  - **Vercel**: `SOCKET_INTERNAL_URL`(Next→socket `/internal/enforce` base URL) + `SOCKET_INTERNAL_SECRET`(서명, OCI와 **동일값**).
- 미설정 시: `dispatch.ts`가 graceful degrade(`enforced=false`, prod에서만 error 로그), 서버는 503 — **크래시 아님**. 단 접속 중 제재가 실시간 전파 안 됨(DB만 반영, 재접속 시 차단).
- WI-001 join 게이트가 재접속 차단을 보장하므로 보안 회귀는 제한적.

### 4.3 prod DB 마이그레이션 2건 (수동 — build에 migrate deploy 없음)
- **WI-016 `isShared`** = 🔴 **go-live 게이트(데이터 정확성)**: 코드(`GET /api/assets?shared=true`, `route.ts:24`)가 `isShared`를 쿼리. prod엔 이미 2026-03 db push로 컬럼 존재 추정 → **기존 prod는 정상**. 단 fresh DB(CI/staging)는 마이그레이션 미적용 시 `column isShared does not exist` 크래시. 마이그레이션은 멱등(`IF NOT EXISTS`).
  - **적용 전 prod `\d "GeneratedAsset"`로 컬럼/복합 인덱스 실제 정의 확인 권장**(인덱스 부재 은닉 회피). 멱등 `migrate deploy`(컬럼 skip·인덱스 없으면 생성) 또는 인덱스 확인 후 `migrate resolve --applied 20260622130000_generated_asset_is_shared`.
- **WI-013 Space 복합 인덱스** = 성능 게이트(런타임 무관): 인덱스 없어도 쿼리 정확(구 인덱스+in-memory sort, 느릴 뿐). **승격과 분리 가능**(merge 후 적용 OK).
  - ⚠️ 비-CONCURRENTLY `CREATE/DROP INDEX`는 대용량 prod서 쓰기 락. **direct(비-PgBouncer) connection서 `CREATE INDEX CONCURRENTLY`/`DROP INDEX CONCURRENTLY` + `migrate resolve --applied 20260622120000_space_hot_query_index`** 권장. 소규모 + 저트래픽 윈도우 + `lock_timeout`/`statement_timeout` 준비 시에만 일반 `migrate deploy` 무방.
  - 적용 후 **프로덕션 EXPLAIN로 cursor seek 효율 검증**(Codex 지목).

### 4.4 API 계약 변경 (라이브 클라이언트 호환)
- WI-009 `inviteCode` 목록 응답 제거 / WI-010 `nextCursor`·`hasMore` 추가 / WI-014 응답 allowlist / WI-001 guest accessSecret 검증.
- Vercel은 웹 클라이언트+API를 **함께** 배포 → 신·구 정합. 유일 리스크 = 배포 순간 **구 JS 캐시 탭**이 새 API 호출 → refresh로 자가치유(transient). WI별 검증서 소비처 무영향 확인됨.

### 4.5 머지 전략 / Vercel author (P1)
- 최근 develop의 PR 머지 커밋들이 `FlowCoder_CYH <kryou1@naver.com>` author로 찍힘 → **merge commit 방식이면 최종 main HEAD author가 인가계정 아닐 위험**(Vercel 배포 차단 가능).
- **권장**: 승격 머지를 **인가 계정(`flowcoder25`)으로 수행** + squash/rebase로 HEAD author를 인가계정으로 고정, 또는 머지 후 인가계정 빈 커밋으로 재트리거(WI-007 선례). 머지 직후 Vercel 배포 상태 확인 필수.

---

## 5. 롤백 계획 (Codex 협의 반영)

### 사전 기록(승격 전 필수)
- 현재 main HEAD(`38459d5`), 현재 OCI commit SHA / image ID / container ID, OCI `.env` checksum.
- 가능하면 **현재 OCI 이미지를 명시 태그로 보존**(예: `flowspace-socket:pre-WI016`).

### 웹(Vercel)
- **Vercel instant rollback**(이전 배포로 즉시 회귀) — 1차 수단.
- main에 revert 머지 — 2차(소스 정합).

### 소켓(OCI)
- `docker compose up --build`는 빌드 실패 시 **기존 컨테이너 유지**(즉시 장애 아님).
- 새 컨테이너 crash-loop 시: 보존 이미지/이전 commit으로 **즉시 `up -d` 회귀**. 배포는 `build → up → healthcheck → logs 확인` 순.

### DB
- WI-013 인덱스: `DROP INDEX CONCURRENTLY Space_status_updatedAt_id_idx` + 구 인덱스 재생성으로 회귀(데이터 무손실).
- WI-016 컬럼: prod 기존 컬럼 → 회귀 불필요(드리프트 정합일 뿐).

---

## 6. 권장 실행 순서 (사용자 승인 후)

1. **env 선확정**(merge 전): AUTH_SECRET fingerprint 일치(Vercel↔OCI, ≥32자) + SOCKET_INTERNAL_SECRET(OCI·Vercel 동일) + SOCKET_INTERNAL_URL(Vercel) + CORS_ORIGINS(OCI=Vercel 도메인) 확인.
2. **prod DB 확인/적용**: `\d "GeneratedAsset"`(isShared 컬럼 존재 확정=go-live 게이트) → WI-016 멱등 적용. WI-013 인덱스는 CONCURRENTLY로 별도(merge 전/후 무관).
3. **사전 기록 + 이미지 태그 보존**(롤백 대비).
4. **승격 PR(develop→main) 생성 + `promotion-approval.json` 승인** → **인가계정으로 머지**(author 고정).
5. **smoke test**: 로그인 → `/api/socket/token` 200 → 메타버스 진입 → 실시간 이동/채팅 동기화 → (env 설정 시) 제재 실시간 반영.
6. 실패 시 5절 롤백.

> **빅뱅 vs 분할(Codex E)**: 89커밋 사후 분할은 비용·실수 위험이 큼 → "강한 게이트를 둔 단일 승격"이 현실적. 단 1·2·3·5 게이트 충족이 전제(미충족 시 빅뱅 반대).

---

## 7. Claude가 실행 불가 (사용자 전용)

다음은 내 접근 권한 밖 — **사용자만 수행/검증 가능**:
- Vercel 대시보드(AUTH_SECRET/env fingerprint, 배포, instant rollback)
- OCI SSH/대시보드(prod `.env`, docker 이미지 태그, 컨테이너)
- prod DB(`\d`, EXPLAIN, CONCURRENTLY 마이그레이션, `migrate resolve`)
- `promotion-approval.json` 승인(process 07 step 3)

Claude가 수행 가능: 승격 PR 생성·PR 본문 작성·머지 author 가이드(실 머지는 인가계정 필요). **머지 자체가 비가역 라이브 배포를 발동하므로, 위 운영 게이트 충족 확인 전에는 머지하지 않음.**
