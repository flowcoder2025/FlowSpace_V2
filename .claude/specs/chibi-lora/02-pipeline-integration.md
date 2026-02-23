# Phase 4: FlowSpace 파이프라인 통합

> Epic: [치비 LoRA 학습](./README.md)
> 상태: 완료 | 업데이트: 2026-02-22

## 목표
학습된 LoRA를 자동 감지하여 기존 yuugiri 대체 사용하는 동적 LoRA 선택 시스템 구현.

## 구현 상세

### capability-checker.ts — LoRA 감지 확장
- `flowspace-chibi` 키워드를 hasChibiLoRA 검사에 추가
- 기존 `chibistyle`, `yuugiri` 유지 (하위 호환)

### constants.ts — 3개 상수 추가
```typescript
CHIBI_LORA_PRIORITY = ["flowspace-chibi", "chibistyle", "yuugiri"]
CHIBI_LORA_FALLBACK = "yuugiri-lyco-nochekaiser.safetensors"
CHIBI_LORA_TRIGGER = "flowspace_chibi"
```

### processor.ts — 동적 LoRA 선택
- `resolveBestChibiLora(loraModels)`: 우선순위에 따라 최적 LoRA 자동 선택
- `maybeAddTriggerWord(prompt, loraName)`: flowspace-chibi 사용 시 트리거워드 자동 추가
- Phase A/B 모두 `lora_name` 파라미터 주입

### 워크플로우 JSON 3개 — lora_name 파라미터 추가
- `character-chibi-frame.json`
- `character-chibi-fallback.json`
- `character-chibi-ipadapter.json`
- 모두 `_meta.parameters.lora_name` 추가 (nodeId: "13", field: "lora_name")
- default: `"yuugiri-lyco-nochekaiser.safetensors"` (하위 호환)

## 변경된 파일
| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `src/features/assets/internal/capability-checker.ts` | 수정 | flowspace-chibi 감지 |
| `src/features/assets/internal/constants.ts` | 수정 | CHIBI_LORA_PRIORITY 등 3상수 |
| `src/features/assets/internal/processor.ts` | 수정 | resolveBestChibiLora + lora_name 주입 |
| `comfyui-workflows/character-chibi-frame.json` | 수정 | lora_name 파라미터 |
| `comfyui-workflows/character-chibi-fallback.json` | 수정 | lora_name 파라미터 |
| `comfyui-workflows/character-chibi-ipadapter.json` | 수정 | lora_name 파라미터 |

## 검증
- tsc ✅ lint ✅ vitest 52/52 ✅
