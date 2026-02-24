# FlowSpace Specs Index

## Drift Tracking
- Last Reviewed Commit: `f27fdee`
- Last Review Date: 2026-02-23

## Active Epics
| Epic | 현재 Phase | 상태 |
|------|-----------|------|
| [chibi-pipeline](./chibi-pipeline/README.md) | Phase 12 (3D→2D→치비 파이프라인) | 일반 인간형→3D 변환→4방향 렌더링→치비화 파이프라인 검증 예정 |

## Recently Completed
| Epic | 완료일 | 핵심 결과 |
|------|--------|-----------|
| [chibi-pipeline](./chibi-pipeline/README.md) Phase 1~10 | 2026-02-23 | batch v2, 77% 속도 향상 |

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
- 에셋 갤러리 리팩토링: 스튜디오/생성폼 제거, 단일 갤러리 통합 (커밋: 7a8287a)
- 오피스 테마 에셋 배치 생성 (캐릭터 3 + 타일셋 1 + 맵 1)
- 프롬프트 프리픽스/네거티브 강화 (tileset/map/object 픽셀아트)

## Ad-hoc Work (2026-02-21)
- 배포 준비: Dockerfile, docker-compose, CI, Vitest, Prisma migrate
- 실사용 버그 수정: 소켓 인증, Prisma PgBouncer, 채팅 id 충돌, Phaser 키보드
- 채팅 레거시 스타일 포팅: 드래그/리사이즈, Enter 활성화, 반투명 배경
- 채팅 lint 수정: chat-panel.tsx ref + chat-input-area.tsx 의존성

## File Structure
```
specs/
├── _index.md
├── comfyui-asset-pipeline/
│   ├── README.md
│   ├── 01-infra-and-pipeline.md
│   ├── 02-auth-and-spaces.md
│   ├── 03-socket-realtime.md
│   ├── 05-phaser-game-engine.md
│   ├── 06-chat-system.md
│   ├── 06-chat-system-enhanced.md
│   ├── 07-comfyui-integration-nav.md
│   ├── 07-comfyui-enhanced.md
│   └── decisions/
│       └── 2026-02-19-multi-agent-system.md
├── map-editor/
│   ├── README.md
│   └── 08-map-editor.md
├── admin-dashboard/
│   ├── README.md
│   └── 09-admin-dashboard.md
├── chat-port/
│   ├── README.md
│   └── 10-chat-port.md
├── livekit-voicevideo/
│   ├── README.md
│   └── 11-livekit-integration.md
├── parts-avatar-system/
│   ├── README.md
│   ├── 01-core-engine.md
│   ├── 02-customization-ui.md
│   └── 03-ingame-integration.md
├── asset-integration/
│   ├── README.md
│   └── 01-integration-fix.md
└── chibi-pipeline/
    ├── README.md
    ├── 01-frame-generation.md
    ├── 08-ipadapter-identity.md
    ├── 10-batch-refactoring.md
    ├── 11-consistency-optimization.md
    └── decisions/
        ├── 2026-02-22-pixelart-to-chibi.md
        ├── 2026-02-22-normalize-strategy.md
        ├── 2026-02-22-ipadapter-identity.md
        └── 2026-02-22-lora-training.md
```
