# 03. 듀얼 블라인드 검증

fdp_app design/03. 구현 검증 단계에서 **codex + evaluator를 상호 블라인드·독립 병렬** 실행 후 Claude(오케스트레이터)가 통합. 편향 방지가 목적 — 한쪽 결과를 다른 쪽에 주입하지 않는다.

## 두 검증자 (보완, 중복 아님)
| 검증자 | 모델 | 축 | 산출 |
|--------|------|----|------|
| **codex** | gpt-5.x (CLI) | 구현전환리스크·UX·접근성·모바일·**보안·라우팅**·Phaser 생명주기 | `<WI>.codex.json` |
| **evaluator** | Claude/Opus (`agents/evaluator-agent.md`) | 4축 채점: 완성도·정합성·구체성·실행가능성 + 코드 결함 | `<WI>.eval.json` |

둘 다 `schemas/review.schema.json` 강제 → 동일 계약으로 정규화.

## codex 검증 호출 (스키마 강제)
```bash
"$CODEX" exec --json \
  --output-schema .claude/process/schemas/review.schema.json \
  -o .flowset/eval-results/<WI>.codex.json \
  -s read-only -C "C:/Team-jane/FlowSpace" --skip-git-repo-check --ephemeral - < codex-prompt.md
```
- **권위 = `-o` 파일**(마지막 agent_message). 스트림 중간 메시지는 오판정 유발 → 무시.
- 성공 = exit 0 + `error`/`turn.failed` 이벤트 없음 + `-o` 유효 JSON.
- 프롬프트: "active WI(`.flowset/current.json`) + git diff만 ground truth로. 파일 수정 금지. 스키마만 반환."

## 통합 & 게이트
1. 두 산출물을 `<WI>.merged.json`으로 dedup (issue fingerprint = `severity + 정규화 location + 정규화 description`).
2. 수렴(양쪽 발견) = 고신뢰. 발산(한쪽) = 오케스트레이터가 코드로 재확인.
3. **도구 실패 ≠ 제품 실패**: JSON 누락·스키마 불일치·spawn 오류는 도구 실패 → 재시도(≤3) → 초과 시 `ESCALATE`(사람 판단). 제품 FAIL로 기록 금지.
4. `.merged.json`에 P0/P1 또는 `fixNow:true` 없음 + 기계 게이트 통과 → `.pass` 생성. 아니면 미생성.

## 수렴 가드
- 재검증 라운드당 신규 이슈가 과다(>N)면 검증자 노이즈 → `ESCALATE`.
- 직전 라운드 대비 이슈 감소 = 진전으로 인정, 재시도 카운트 별도.
- 사이클당 검증 ≤3회.
