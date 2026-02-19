# RACI Decision Matrix

## Legend
- **R** (Responsible): 실행 담당
- **A** (Accountable): 최종 책임/승인
- **C** (Consulted): 자문 (의견 제공)
- **I** (Informed): 통보 (결과 공유)

## Decision Matrix

| 결정 사항 | Human | Orchestrator | Domain Agent | QA (검증) |
|-----------|-------|-------------|-------------|-----------|
| 제품 범위 정의 | **A** | R | C | C |
| Epic/Phase 구조 | C | **A/R** | C | I |
| 태스크 우선순위 | C | **A/R** | C | C |
| 도메인 내부 설계 | I | C | **A/R** | C |
| 도메인 contract 변경 | C | C | **A/R** | C |
| 교차 도메인 API 변경 | **A** | R | R | C |
| shared contract 변경 | **A** | R | C | C |
| 코드 구현 | I | C | **A/R** | C |
| 검증 통과/실패 | C | C | C | **A/R** |
| main 머지 | C | **A/R** | C | R (거부권) |
| 기술 스택 변경 | **A** | R | C | C |
| Breaking Change | **A** | R | R | C |

## Domain-Specific Authority

### Game Engine Agent
- Phaser 씬 구조 및 렌더링 로직: **A/R**
- EventBridge 이벤트 정의: **A/R** (타 도메인 C)
- 캐릭터/맵 렌더링 최적화: **A/R**

### Asset Pipeline Agent
- ComfyUI 워크플로우 설계: **A/R**
- 에셋 포맷/규격 정의: **A/R** (Game Engine C)
- 후처리 파이프라인: **A/R**

### Communication Agent
- Socket.io 이벤트 프로토콜: **A/R**
- 실시간 동기화 전략: **A/R**
- 서버 아키텍처: **A/R**

### Frontend Agent
- UI 컴포넌트 설계: **A/R**
- 페이지 라우팅: **A/R**
- 상태관리 (Zustand): **A/R**

### Backend Agent
- DB 스키마 설계: **A/R**
- API 엔드포인트 설계: **A/R**
- 인증/인가 로직: **A/R**

## Escalation Path

```
Domain Agent 판단 불가
  → Orchestrator 중재
    → 해결 불가 시 Human 판단 요청
```

## Contract Change Process

1. 변경 요청 도메인이 draft 작성
2. 영향받는 도메인에 C (자문) 요청
3. Orchestrator가 호환성 검증
4. 교차 도메인 변경 시 Human 승인 필요
5. 승인 후 contract 버전 업데이트 (SemVer)
