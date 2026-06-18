# 00. 프로세스 개요

FlowSpace 개발 운영 방법론. fdp_app 프로세스 구조 + 검증 규율을 **A안**(런타임 러너 미이식)으로 이식, Claude Code 훅/에이전트로 운영.

## 전제
- FlowSpace = Next.js 15(App Router) + Phaser 3 **단일 앱** (pnpm 모노레포 아님).
- fdp_app `packages/core` 러너는 **이식하지 않는다**. 오케스트레이션은 Claude Code + 훅 스크립트가 담당.
- `.flowset/`가 프로세스 상태 SSOT (`02-cycle` 참조).

## 3계층 분리 (섞지 말 것)
| 계층 | 위치 | 내용 | 가변성 |
|------|------|------|--------|
| **절차** | `.claude/process/` | 작업 방법(이 문서들) | 프로세스 개선 시 변경 |
| **도메인 불변식** | `.claude/rules/` | app·communication·data-ownership·game-engine·asset-pipeline·asset-spec | 보존(별도 WI로만) |
| **제품 지식** | `.claude/specs/`, `.claude/memory/` | 스펙 60+, auto-memory 교훈 | **불가침 — 읽기/참조만** |

## 핵심 원칙
1. **신호 ≠ 진실** — LLM 주장은 ground truth(git/파일/CI)로만 검증.
2. **WI 1개만 ACTIVE** — `01-work-item-cycle`.
3. **듀얼 블라인드 검증** — codex + evaluator 독립 병렬, `03-dual-verification`.
4. **도구 실패 ≠ 제품 실패** — 검증 도구 오류를 제품 결함으로 기록 금지.
5. **지식 자산 보존** — 프로세스 이식이 지식 정리로 변질되지 않게.

## 문서 색인
- `01-work-item-cycle.md` — WI 사이클
- `02-design-consult.md` — Codex 설계 협의 기준
- `03-dual-verification.md` — 듀얼 블라인드 검증
- `04-ground-truth-gates.md` — 기계 게이트
- `05-handoff-and-clear.md` — 핸드오프/clear
- `06-issue-taxonomy.md` — 결함 분류(P0~P3)
- `07-branching-and-promotion.md` — 브랜치 모델(main 동결/develop 통합/wi 작업)·승격
- `schemas/review.schema.json` — codex/evaluator 공유 출력 계약
