# 04. 기계 게이트 (Ground Truth)

LLM 주장과 무관하게 **오케스트레이터가 직접 실행**하고 출력 그대로 기록. 통과/실패를 포장하지 않는다.

## 게이트 명령 (CI와 일치)
| 게이트 | 명령 | 통과 조건 |
|--------|------|-----------|
| tsc | `npx tsc --noEmit` | exit 0 |
| lint | `npm run lint` | exit 0 |
| vitest | `npx vitest run` | exit 0, 전 케이스 pass |
| build | `npm run build` | exit 0 |

## 주의 (FlowSpace 환경 실측)
- **stale `.next/types`**: 삭제된 라우트의 고아 타입 파일이 tsc를 깨뜨릴 수 있음. `next build`(fresh) 후 정리됨 → tsc 실패 시 `.next` 재생성으로 확인.
- **Windows Prisma DLL lock**: `npm run build`가 prisma generate에서 DLL 잠금 → dev 서버 종료 후 재시도 또는 `npx next build`.
- vitest 커버리지가 작음(테스트 파일 2개·52케이스) — 게이트 green이 곧 무결 아님. 의미 게이트(`03`)가 보완.

## 기록
- HANDOFF.md `Verification` 표에 게이트별 Result + Evidence 갱신.
- `.pass` 생성 시 통과한 게이트 목록과 commit sha를 마커에 기록.
- 실패 시 실제 출력(에러 수·실패 케이스명)을 그대로 남김. "통과"로 위장 금지.

## `.pass` 형식 (의미 게이트 마커)
`.flowset/eval-results/<WI>.pass` — 모든 게이트 통과 + `.merged.json`에 P0/P1·fixNow 없을 때만 생성. key=value 텍스트:
```
WI=<activeWI>
commit=<git sha>
sourceFingerprint=<flowset_stop_gate.ps1 -EmitFingerprint 출력>
codex=.flowset/eval-results/<WI>.codex.json
evaluator=.flowset/eval-results/<WI>.eval.json
gates=tsc,lint,vitest,build
createdAt=<ISO8601>
```
- **`sourceFingerprint`는 반드시 `powershell -File .claude/hooks/flowset_stop_gate.ps1 -EmitFingerprint`로 생성** — Stop 게이트가 stale 검사에 동일 알고리즘으로 비교하므로, 수기 계산하면 항상 stale로 오탐됨.
- 변경분이 더 생기면 fingerprint가 바뀌어 Stop 게이트가 차단 → 재검증 후 `.pass` 갱신.

## Stop 게이트 (기계 강제)
`.claude/hooks/flowset_stop_gate.ps1` (settings.json `Stop` 훅). 결정적·경량:
ACTIVE WI에 source(.ts/.tsx/.prisma) 변경이 있고 유효한 `.pass`가 없으면 종료 차단. LLM 판단 없이 git·`.flowset`만 검사. 옛 prompt 훅(qa/doc-agent 강제)은 제거됨 — 게이트 기준은 "agent 실행 여부"가 아니라 "`.pass` 존재+최신성".
