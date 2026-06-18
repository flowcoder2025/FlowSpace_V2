# 01. Work Item 사이클

## WI 정의
- `fix_plan.md`의 작업 단위. ID 형식 `WI-NNN-[type]` (type = wi-global enum: feat·fix·docs·style·refactor·test·chore·perf·ci·revert).
  - 예: `WI-001-fix`(보안 수정), `WI-003-refactor`(경계 정리). 설명은 Goal 필드에.
- 상태: `READY | ACTIVE | VERIFY | BLOCKED | DONE | DROPPED`.
- **한 번에 하나만 `ACTIVE`** — `current.json.activeWI`가 단일 진실.

## 사이클 단계
```
설계 → 구현 → 검증 → 핸드오프 → clear
```
1. **설계** — 수용 기준 확정. 경계 변경(공개 API·DB schema·auth·socket·Phaser 생명주기)이면 Codex 협의(`02`).
2. **구현** — 기존 코드 먼저 읽기. placeholder/TODO/stub 금지. 도메인 `rules/` 준수.
3. **검증** — 기계 게이트(`04`) + 듀얼 블라인드(`03`). 산출물은 `.flowset/eval-results/`.
4. **핸드오프** — `HANDOFF.md` 갱신, `handoffs/cyc_*.md` 아카이브(`05`).
5. **clear** — `.pass` 생성 시에만 WI를 `DONE`으로, `current.json` 다음 WI로 전환.

## 게이트 통과 조건 (WI → DONE)
모두 만족해야 `.pass` 생성:
- 기계 게이트 전부 PASS (tsc·lint·vitest·build)
- codex + evaluator 둘 다 산출물 존재 + 스키마 유효
- 통합(`.merged.json`)에 **P0/P1 또는 `fixNow:true` 없음**

하나라도 미달이면 `.pass` 없음 → WI는 `BLOCKED`/`VERIFY` 유지 → 재시도(≤3, `03`).

## 상태 전이
```
READY ──선택──▶ ACTIVE ──구현완료──▶ VERIFY ──게이트통과──▶ DONE
                  │                      │
                  └──── BLOCKED ◀────────┘ (P0/P1 또는 게이트 실패)
```
