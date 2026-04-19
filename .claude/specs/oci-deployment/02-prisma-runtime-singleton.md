# Phase 2: Prisma 런타임 — Docker 통합 + 싱글턴 패턴

> Epic: [oci-deployment](./README.md)
> 상태: 완료 | 완료일: 2026-04-19

## 개요
Socket.io Docker 이미지에서 `@prisma/client did not initialize yet` 에러 수정.
esbuild external + dynamic import 방식으로 Prisma runtime을 Alpine 이미지에 포함하고,
핸들러 전체에 `getPrisma()` 싱글턴을 적용하여 PgBouncer connection을 재사용.

## 변경 파일
| 파일 | 변경 유형 |
|------|-----------|
| `Dockerfile.socket` | 수정 — Prisma generate + runtime 복사 추가 |
| `prisma/schema.prisma` | 수정 — `linux-musl-openssl-3.0.x` binary target 추가 |
| `server/lib/prisma.ts` | 신규 — `getPrisma()` 싱글턴 헬퍼 |
| `server/handlers/room.ts` | 수정 — `getPrisma()` 로 전환 |
| `server/handlers/chat.ts` | 수정 — `getPrisma()` 로 전환 |
| `server/handlers/media.ts` | 수정 — `getPrisma()` 로 전환 |

## 주요 구현

### 장애 원인

esbuild가 `server/index.ts`를 단일 번들로 묶을 때 `@prisma/client`를 인라인하려 시도하나,
Prisma client는 Alpine musl 환경용 네이티브 바이너리를 런타임에 동적으로 로드한다.
번들 안에 포함되면 바이너리 경로를 찾지 못해 `did not initialize yet` 에러 발생.

**이전 빌드 커맨드**: bufferutil/utf-8-validate만 external 처리
```bash
RUN npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/server.js \
  --external:bufferutil \
  --external:utf-8-validate
```

### Dockerfile.socket 수정 (핵심 변경)

```dockerfile
# Build stage: esbuild로 단일 JS 파일 번들링
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Prisma client 생성 (alpine musl binary 자동 감지)
COPY prisma/ ./prisma/
RUN npx prisma generate

COPY server/ ./server/
COPY src/features/space/socket/internal/types.ts ...
COPY src/features/space/chat/internal/chat-constants.ts ...
COPY tsconfig.json ./

RUN npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/server.js \
  --external:bufferutil \
  --external:utf-8-validate \
  --external:@prisma/client \
  --external:.prisma/client

# Production stage
FROM node:20-alpine
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 socketio

# Bundle + Prisma runtime (generated client + engine binary)
COPY --from=builder --chown=socketio:nodejs /app/dist/server.js ./server.js
COPY --from=builder --chown=socketio:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=socketio:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=socketio:nodejs /app/prisma/schema.prisma ./prisma/schema.prisma

USER socketio
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "server.js"]
```

**설계 결정**:
- `@prisma/client`, `.prisma/client` 모두 external — dynamic import로 런타임 로드
- `node_modules/@prisma`, `node_modules/.prisma` 프로덕션 스테이지에 복사 (generated client + engine)
- `prisma/schema.prisma`만 복사 (migrations/ 제외 → 이미지 크기 절감)
- `migrations/`는 OCI에서 불필요 (마이그레이션은 Supabase에 직접 적용)

### prisma/schema.prisma — binary target 추가

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "rhel-openssl-3.0.x"]
}
```

- `linux-musl-openssl-3.0.x`: Alpine Linux(OCI Docker) 대상 — 이번에 추가
- `rhel-openssl-3.0.x`: 기존 OCI VM (Ubuntu) 대상
- `native`: 로컬 개발 환경

### server/lib/prisma.ts — 싱글턴 헬퍼 (신규)

```typescript
// Supabase PgBouncer 환경에서 connection pool 재사용을 위해 단일 인스턴스 유지
// Dynamic import로 번들링 회피 (esbuild --external:@prisma/client)

type PrismaClientType = import("@prisma/client").PrismaClient;

let clientPromise: Promise<PrismaClientType> | null = null;

export function getPrisma(): Promise<PrismaClientType> {
  if (!clientPromise) {
    clientPromise = import("@prisma/client").then(
      ({ PrismaClient }) => new PrismaClient()
    );
  }
  return clientPromise;
}
```

**설계 결정**:
- `let clientPromise`로 모듈 수명 동안 단일 인스턴스 보장
- dynamic `import("@prisma/client")`로 esbuild external과 호환
- `$disconnect()` 호출 제거 — 서버 프로세스가 종료될 때 OS가 정리

### handlers 적용 — getPrisma() 전환

이전 패턴 (3개 핸들러 모두):
```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
// ... 사용 후
await prisma.$disconnect();
```

이후 패턴:
```typescript
import { getPrisma } from "../lib/prisma";

async function loadMemberInfo(...): Promise<void> {
  const prisma = await getPrisma();
  const member = await prisma.spaceMember.findUnique({ ... });
}
```

적용 파일: `room.ts` (loadMemberInfo), `chat.ts` (메시지 저장), `media.ts` (녹화 상태 기록)
총 5개 호출 지점 싱글턴 통합.

## 배포 현황 (2026-04-19 기준)

| 컴포넌트 | 상태 | 비고 |
|---------|------|------|
| Docker 이미지 빌드 | 정상 | `RUN npx prisma generate` 통과 |
| `getPrisma()` 초기화 | 정상 | dynamic import 동작 확인 |
| `loadMemberInfo` | 정상 | 멤버 role/restriction 로드 성공 |
| CD 워크플로우 | 미동작 | `OCI_SSH_PRIVATE_KEY` Secret 미설정 — 수동 배포 중 |

## 비고
- CD가 미동작 상태이므로 OCI 배포는 수동: `git pull && docker compose -f docker-compose.prod.yml up --build -d`
- Supabase PgBouncer 환경에서 `$disconnect()` 반복 호출 시 connection 낭비 → 싱글턴이 필수
- `NEXT_PUBLIC_API_URL=https://space.flow-coder.com` 환경변수 OCI docker-compose에 수동 추가 → ECONNREFUSED 해결 (이전에 누락)
