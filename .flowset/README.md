# .flowset — 프로세스 상태 원장 (SSOT)

FlowSpace 개발 프로세스의 **파일 기반 상태 원장**. fdp_app 방식(러너 미이식, A안)을 Claude Code 훅/에이전트로 운영.

## 원칙
- **신호 ≠ 진실**: LLM이 "했다"고 말한 것은 주장일 뿐. 권위는 `git diff`, `.flowset/eval-results/*.json`, `.pass` 마커, CI 결과 같은 ground truth.
- **WI 1개만 ACTIVE**: 한 번에 하나의 Work Item만 진행.
- **지식 자산 불가침**: `.claude/memory`, `.claude/rules`, `.claude/specs`는 이 프로세스의 **입력**이지 대상이 아니다. 읽기/참조만.

## 파일
| 경로 | 역할 |
|------|------|
| `fix_plan.md` | WI 워크리스트 (`WI-NNN-[type]`), 수용 기준, 게이트 |
| `current.json` | 훅이 읽는 기계 판독 활성 상태 |
| `HANDOFF.md` | 현재 세션 핸드오프 (mutable) |
| `eval-results/<WI>.codex.json` | Codex 독립 검증 결과 (스키마강제) |
| `eval-results/<WI>.eval.json` | evaluator(Claude) 독립 검증 결과 (스키마강제) |
| `eval-results/<WI>.merged.json` | 두 결과 dedup 통합 원장 |
| `eval-results/<WI>.pass` | 의미 게이트 통과 마커 (P0/P1·fixNow 없음 + 기계게이트 통과 시에만 생성) |
| `handoffs/cyc_*.md` | 사이클별 핸드오프 아카이브 |

## 사이클
`설계 → 구현 → 검증(듀얼 블라인드) → 핸드오프 → clear`. 절차 상세는 `.claude/process/`.
