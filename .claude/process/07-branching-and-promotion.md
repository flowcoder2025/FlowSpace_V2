# 07. 브랜치 모델 & 승격

```
main(동결) ── 파생 ──▶ develop(통합/작업 메인)
                          │
                          ├── fix/WI-001-fix-...  ──검증·.pass──▶ develop (PR 머지)
                          ├── refactor/WI-003-...  ──검증·.pass──▶ develop
                          │
                          └── (전체 green + 승인) ──승격 PR──▶ main
```

## 브랜치
| 브랜치 | 역할 | 규칙 |
|--------|------|------|
| `main` | 안정/배포 라인 (**동결**) | 직접 커밋 금지. develop 승격 PR로만 갱신 |
| `develop` | 통합 "작업 메인" | main에서 파생. 모든 WI가 여기로 머지 |
| `<type>/WI-NNN-<type>-<slug>` | WI별 작업 | develop에서 분기, 게이트 통과 후 develop로 PR 머지 |

- WI ID/타입은 wi-global enum: feat·fix·docs·style·refactor·test·chore·perf·ci·revert.
- 브랜치 형식(wi-global): `fix/WI-001-fix-auth-authz`, `refactor/WI-003-refactor-arch-boundary` 등.
- 커밋: `WI-NNN-[type] 한글 작업명` 또는 conventional(`fix: ...`). main/develop 직접 push 금지(PR).

## WI 머지 (→ develop)
1. WI 작업 브랜치에서 구현.
2. 기계 게이트(tsc/lint/vitest/build) PASS.
3. 듀얼 검증(codex+evaluator) → `.merged.json`에 P0/P1·fixNow 없음.
4. `.pass` 생성 (`sourceFingerprint` 포함, `04` 참조). Stop 게이트가 `.pass` 없으면 로컬 종료 차단.
5. develop로 PR 머지. CI 의미게이트가 PR에서 `.pass` 확인(도입 시).

## 승격 (develop → main)
"결과가 괜찮으면 메인으로 승격" 단계. 단일 WI엔 과하지만 develop→main 경계엔 적합 → fdp_app promotion 계층 활성화:
1. 모든 큐 WI `DONE` + develop 전체 게이트 green + 실사용 검증.
2. `.flowset/promotion-readiness.md` 작성 (변경 요약·게이트·리스크·롤백).
3. 사용자 승인 (`.flowset/promotion-approval.json`).
4. develop → main 승격 PR 머지. main은 그 전까지 **현 상태 동결 유지**.
