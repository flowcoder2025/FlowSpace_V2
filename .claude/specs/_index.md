# FlowSpace Specs Index

## Drift Tracking
- Last Reviewed Commit: `531baf1` (unstaged changes reviewed 2026-03-05)
- Last Review Date: 2026-03-05

## Active Epics
| Epic | 현재 Phase | 상태 |
|------|-----------|------|
| [chibi-pipeline](./chibi-pipeline/README.md) | Phase 12 (멀티뷰 스프라이트시트) | 그리드 이동 완료 (Task 12.31). 다음: 대각선 점프 도약 통일 → 충돌 영역 정밀화 → Y-sorting |

## Recently Completed
| Epic | 완료일 | 핵심 결과 |
|------|--------|-----------|
| [chibi-pipeline](./chibi-pipeline/README.md) Phase 1~11 | 2026-02-23 | batch v2, 77% 속도 향상 |

## Completed Epics
| Epic | 완료일 | Phase 수 |
|------|--------|----------|
| [comfyui-asset-pipeline](./comfyui-asset-pipeline/README.md) | 2026-02-19 | 7 |
| [map-editor](./map-editor/README.md) | 2026-02-19 | 1 (Phase 8) |
| [admin-dashboard](./admin-dashboard/README.md) | 2026-02-19 | 1 (Phase 9) |
| [chat-port](./chat-port/README.md) | 2026-02-20 | 6 (Phase 10) |
| [livekit-voicevideo](./livekit-voicevideo/README.md) | 2026-02-20 | 1 (Phase 11) |
| [parts-avatar-system](./parts-avatar-system/README.md) | 2026-02-21 | 3 (Phase 1~3) |
| [asset-integration](./asset-integration/README.md) | 2026-02-22 | 1 (연동 수정) |

## Ad-hoc Work (2026-02-22)
- 에셋 갤러리 리팩토링: 스튜디오/생성폼 제거, 단일 갤러리 통합
- 오피스 테마 에셋 배치 생성 (캐릭터 3 + 타일셋 1 + 맵 1)

## Ad-hoc Work (2026-02-21)
- 배포 준비: Dockerfile, docker-compose, CI, Vitest, Prisma migrate
- 실사용 버그 수정: 소켓 인증, Prisma PgBouncer, 채팅 id 충돌, Phaser 키보드

## File Structure
```
specs/
├── _index.md
├── comfyui-asset-pipeline/
│   ├── README.md
│   ├── 01~07 phase specs
│   └── decisions/
├── map-editor/
├── admin-dashboard/
├── chat-port/
├── livekit-voicevideo/
├── parts-avatar-system/
├── asset-integration/
└── chibi-pipeline/
    ├── README.md
    ├── 01-frame-generation.md
    ├── 08-ipadapter-identity.md
    ├── 10-batch-refactoring.md
    ├── 11-consistency-optimization.md
    ├── 12-3d-to-chibi-pipeline.md
    ├── quality-checklist.md
    └── decisions/
        ├── 2026-02-22-pixelart-to-chibi.md
        ├── 2026-02-22-normalize-strategy.md
        ├── 2026-02-22-ipadapter-identity.md
        ├── 2026-02-22-lora-training.md
        ├── 2026-02-24-character-sheet-approach.md
        ├── 2026-02-24-depth-controlnet-over-openpose.md
        ├── 2026-02-25-ipadapter-style-composition-back.md
        ├── 2026-02-25-warm-ref-approach.md
        ├── 2026-02-25-6char-adoption.md
        ├── 2026-02-25-2pass-abandoned.md
        ├── 2026-02-25-code-based-walking.md
        ├── 2026-02-25-resolution-upgrade-96x128.md
        ├── 2026-02-25-premultiply-alpha-defringe.md
        ├── 2026-02-25-white-outline-root-cause.md
        └── 2026-03-03-hunyuan3d-back-view.md
```
