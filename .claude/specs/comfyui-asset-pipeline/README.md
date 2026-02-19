# Epic: ComfyUI Asset Pipeline

## Overview
ComfyUI 기반 에셋 파이프라인을 도입하여 게임엔진 내 캐릭터, 오브젝트, 맵 에셋을 AI로 자동 생성하는 시스템 구축

## Status: 진행중
- 시작일: 2026-02-19
- Phase 진행: Phase 1 완료

## Phases
| Phase | 이름 | 상태 |
|-------|------|------|
| 1 | [팀 인프라 + 에셋 파이프라인 기반](./01-infra-and-pipeline.md) | 완료 |

## Architecture Decisions
- 5개 도메인 에이전트 + 오케스트레이터 체제
- Contract Governance (FlowHR 패턴)
- ComfyUI REST API + Mock mode
- flow_metaverse 스키마 기반 확장

## Key References
- flow_metaverse: `C:\Team-jane\flow_metaverse\`
- EventBridge, AssetRegistry, TilesetGenerator 패턴 포팅
