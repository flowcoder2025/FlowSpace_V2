# Phase 1: 팀 인프라 + 에셋 파이프라인 기반

> Epic: [ComfyUI Asset Pipeline](./README.md)
> 상태: 완료 | 업데이트: 2026-02-19

## 목표
1. 멀티에이전트 팀 인프라 구축 (5 도메인 + 오케스트레이터)
2. Next.js 15 프로젝트 스캐폴드
3. ComfyUI 에셋 파이프라인 기본 구조 생성
4. 에셋 API + UI + Phaser 로더 통합

## Task 목록

### 1단계: 팀 인프라
- [x] Task 1.1: 디렉토리 구조 생성
- [x] Task 1.2: PROTOCOL.md, RACI.md 생성
- [x] Task 1.3: 페르소나 5개 생성
- [x] Task 1.4: Contract 파일 (schema + 5 도메인 + 4 shared)
- [x] Task 1.5: Memory 인프라 + specs index

### 2단계: Phase 1 코드 구현
- [x] Task 2.1: Next.js 15 프로젝트 스캐폴드
- [x] Task 2.2: Prisma 스키마 (14 모델, GeneratedAsset/AssetWorkflow 신규)
- [x] Task 2.3: ComfyUI REST 클라이언트 (mock mode 포함)
- [x] Task 2.4: 워크플로우 템플릿 3종
- [x] Task 2.5: 에셋 후처리 파이프라인
- [x] Task 2.6: 에셋 API 엔드포인트 5개
- [x] Task 2.7: 에셋 생성 UI (Zustand + 컴포넌트)
- [x] Task 2.8: Phaser 에셋 로더 + EventBridge 포팅

## 구현 상세

### Task 2.2: Prisma 스키마

```prisma
model GeneratedAsset {
  id            String      @id @default(cuid())
  userId        String
  type          AssetType   // CHARACTER, TILESET, OBJECT, MAP
  name          String
  prompt        String      @db.Text
  workflow      String
  status        AssetStatus @default(PENDING)
  metadata      Json?
  filePath      String?
  thumbnailPath String?
  fileSize      Int?
  comfyuiJobId  String?
  user          User        @relation(...)
}

model AssetWorkflow {
  id          String    @id @default(cuid())
  name        String
  description String?
  template    Json
  version     String    @default("1.0.0")
  assetType   AssetType
  isActive    Boolean   @default(true)
}

enum AssetType { CHARACTER, TILESET, OBJECT, MAP }
enum AssetStatus { PENDING, PROCESSING, COMPLETED, FAILED }
```

### Task 2.3: ComfyUI 클라이언트

```typescript
// src/lib/comfyui/client.ts
class ComfyUIClient {
  async checkConnection(): Promise<boolean>
  async queuePrompt(workflow): Promise<QueuePromptResponse>
  async getHistory(promptId): Promise<HistoryEntry | null>
  async getImage(filename, subfolder, type): Promise<ArrayBuffer>
  async waitForCompletion(promptId): Promise<HistoryEntry>
  async generateAsset(params, workflow): Promise<GenerateAssetResult>
  // Mock implementations for all methods
}
```

### Task 2.6: API 엔드포인트

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/assets/generate` | 에셋 생성 시작 (202 반환) |
| GET | `/api/assets` | 에셋 목록 (type/status/userId 필터) |
| GET | `/api/assets/[id]` | 에셋 상세 |
| DELETE | `/api/assets/[id]` | 에셋 삭제 |
| GET | `/api/workflows` | 워크플로우 목록 |

### Task 2.8: EventBridge

```typescript
// src/features/space/game/events/event-bridge.ts
class EventBridge {
  on(event, callback): void
  off(event, callback): void
  emit(event, ...args): void
  removeAllListeners(event?): void
}
export const eventBridge = new EventBridge(); // Singleton
```

## 변경된 파일

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `.claude/team/PROTOCOL.md` | 추가 | 오케스트레이터 프로토콜 |
| `.claude/team/RACI.md` | 추가 | 의사결정 매트릭스 |
| `.claude/team/personas/*.md` (5) | 추가 | 도메인 에이전트 페르소나 |
| `.claude/team/contracts/*.md` (6) | 추가 | 도메인 contract + schema |
| `.claude/team/shared/*.md` (4) | 추가 | 공유 contract |
| `.claude/memory/**/*.md` (7) | 추가 | 메모리 인프라 |
| `.claude/specs/_index.md` | 추가 | 스펙 인덱스 |
| `package.json` | 추가 | Next.js 15 + 의존성 |
| `tsconfig.json` | 추가 | TypeScript 설정 |
| `next.config.ts` | 추가 | Next.js 설정 |
| `eslint.config.mjs` | 추가 | ESLint flat config |
| `prisma/schema.prisma` | 추가 | 14 모델 (GeneratedAsset, AssetWorkflow 신규) |
| `src/lib/comfyui/**` (4) | 추가 | ComfyUI REST 클라이언트 |
| `src/features/assets/**` (6) | 추가 | 에셋 처리 파이프라인 |
| `src/app/api/assets/**` (3) | 추가 | 에셋 API 라우트 |
| `src/app/api/workflows/route.ts` | 추가 | 워크플로우 API |
| `src/components/assets/**` (2) | 추가 | 에셋 UI 컴포넌트 |
| `src/app/assets/**` (2) | 추가 | 에셋 페이지 |
| `src/stores/asset-store.ts` | 추가 | Zustand 에셋 스토어 |
| `src/features/space/game/**` (5) | 추가 | EventBridge + 에셋 로더 |
| `src/config/asset-registry.ts` | 추가 | 에셋 메타데이터 레지스트리 |
| `comfyui-workflows/*.json` (3) | 추가 | 워크플로우 템플릿 |

## Level 1 검증 결과
- `npx tsc --noEmit`: **통과**
- `npx eslint src/ --quiet`: **통과**
- `npm run build`: **통과** (9 라우트 정상)

## 다음 Phase로 넘기는 것
- 실제 ComfyUI 연동 테스트 (현재 mock mode)
- NextAuth 인증 통합 (API 엔드포인트에 세션 체크)
- Socket.io 서버 구현 (Communication 도메인)
- Phaser 씬 구현 (Game Engine 도메인)
- 단위/통합 테스트 작성
