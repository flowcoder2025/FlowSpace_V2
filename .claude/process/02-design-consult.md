# 02. Codex 설계 협의 (Consult)

fdp_app 원칙: **메인은 Claude, Codex는 ①설계 협의 + ③검증에 독립 파트너로 등장.** 이 문서는 ①.

## 언제 (consult 필수)
경계를 바꾸는 변경 — 구현 착수 전 Codex 협의:
- 공개 API 시그니처 / REST route 계약
- DB schema (`prisma/schema.prisma`) 변경
- 인증/인가 경계 (auth, middleware, socket token, 역할 계층)
- Socket 프로토콜 / 이벤트 타입
- Phaser 생명주기 (scene create/shutdown, eventBridge)

## 언제 (consult 권장)
- 다수 모듈에 걸친 리팩토링
- 성능/동시성(race) 민감 변경
- 새 외부 의존성 도입

## 호출 방식 (검증된 CLI)
협의는 **산문**(스키마 없음), read-only:
```bash
CODEX="$APPDATA/npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe"
"$CODEX" exec -s read-only -C "C:/Team-jane/FlowSpace" \
  --skip-git-repo-check --ephemeral --color never - < prompt.md > consult.out.txt
```
- 네이티브 `codex.exe` 직접 호출 (npm shim `.cmd`/`.ps1`은 shell:false spawn 거부).
- 프롬프트는 **stdin**. 협의 프롬프트에 결정 범위·제약·대안 요청·"내가 놓칠 위험 1가지"를 포함.
- 라운드제: 미수렴 시 r2 (`consult-r2`)로 좁혀 합의.

## 산출
협의 결과는 설계 결정에 통합하고, 중요한 결정은 해당 WI 핸드오프 또는 `.claude/specs/`(제품 지식)에 기록. **협의 자체로 코드를 바꾸지 않는다** — 합의 → Claude 구현.
