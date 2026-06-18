# 05. 핸드오프 & Clear

## 핸드오프 (`.flowset/HANDOFF.md`)
현재 세션의 mutable 상태. 매 작업 단위 후 갱신:
- **Active WI** — `current.json.activeWI`와 일치
- **Ground Truth** — branch, base commit, changed files (PostToolUse가 갱신)
- **Done / Open Issues**
- **Verification** 표 — 게이트별 Result + Evidence 경로

## 사이클 아카이브 (`.flowset/handoffs/cyc_*.md`)
WI가 `DONE` 또는 세션 종료 시 사이클 스냅샷을 아카이브:
- 파일명: `cyc_<YYYY-MM-DD>_<WI>.md`
- 내용: WI 목표·변경 파일·게이트 결과·검증 verdict·이연된 KI(P2/P3)·다음 WI

## Clear 규칙
`/clear`는 Claude가 자기 컨텍스트를 지우는 것 — 스스로 세션 경계를 못 넘는다. 경계는 **파일이 넘긴다**:
1. WI `.pass` 생성 확인 (없으면 clear 전 BLOCKED 사유 기록).
2. `HANDOFF.md` 최신화 + `handoffs/cyc_*.md` 아카이브.
3. `current.json`을 다음 `READY` WI로 전환(또는 activeWI=null).
4. 중요한 결정/교훈은 `.claude/memory`(auto-memory) 또는 `.claude/specs`에 기록 — 단 **지식 파일 정리는 별도 WI**.

## ESCALATE
도구 실패만 누적되어 검증 불가 시 제품 FAIL이 아니라 `ESCALATE` 상태로 남기고 사용자 판단 요청. HANDOFF Open Issues에 사유 명시.
