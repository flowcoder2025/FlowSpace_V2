# Phase 1: Socket.io 프로덕션 인프라

> Epic: [oci-deployment](./README.md)
> 상태: 완료 | 완료일: 2026-03-06

## 개요
Socket.io 서버를 OCI 인스턴스에 Docker로 배포. esbuild 번들링으로 경량 이미지 생성,
GitHub Actions CD로 main 브랜치 push 시 자동 배포.

## 변경 파일
| 파일 | 변경 유형 |
|------|-----------|
| `Dockerfile.socket` | 신규 |
| `docker-compose.prod.yml` | 신규 |
| `.github/workflows/deploy-socket.yml` | 신규 |
| `server/index.ts` | 수정 — CORS 다중 origin 지원 |
| `src/features/space/socket/internal/socket-client.ts` | 수정 — NEXT_PUBLIC_SOCKET_URL 지원 |
| `.env.example` | 수정 — NEXT_PUBLIC_SOCKET_URL 항목 추가 |

## 주요 구현

### Dockerfile.socket (멀티스테이지 빌드)

```dockerfile
# Build stage: esbuild로 단일 JS 파일 번들링
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server/ ./server/
COPY src/features/space/socket/internal/types.ts ./src/features/space/socket/internal/types.ts
COPY src/features/space/chat/internal/chat-constants.ts ./src/features/space/chat/internal/chat-constants.ts
COPY tsconfig.json ./

RUN npx esbuild server/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/server.js \
  --external:bufferutil \
  --external:utf-8-validate

# Production stage: 번들 파일만 포함
FROM node:20-alpine
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 socketio
COPY --from=builder --chown=socketio:nodejs /app/dist/server.js ./server.js
USER socketio
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "server.js"]
```

**설계 결정**:
- esbuild로 모든 의존성 인라인 → 프로덕션 이미지에 node_modules 불필요
- `chat-constants.ts`를 별도 COPY: 서버 코드가 클라이언트 상수를 공유하는 구조 반영
- `bufferutil`, `utf-8-validate`는 optional native 모듈 → external 처리 (없어도 동작)
- `socketio` 비루트 유저로 실행 (보안)

### docker-compose.prod.yml

```yaml
services:
  socket:
    build:
      context: .
      dockerfile: Dockerfile.socket
    ports:
      - "${SOCKET_PORT:-3002}:${SOCKET_PORT:-3002}"
    env_file: .env
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:${SOCKET_PORT:-3002}/socket.io/?EIO=4&transport=polling"]
      interval: 30s
      timeout: 5s
      retries: 3
```

**설계 결정**:
- `env_file: .env` 사용 → OCI 서버의 `.env`에 비밀값 직접 관리 (GitHub Secrets 불요)
- healthcheck: Socket.io polling 엔드포인트로 컨테이너 상태 확인
- Next.js(Vercel), DB(Supabase)는 별도 관리 — compose에 포함하지 않음

### GitHub Actions CD (deploy-socket.yml)

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'server/**'
      - 'src/features/space/socket/internal/types.ts'
      - 'Dockerfile.socket'
      - 'docker-compose.prod.yml'

jobs:
  deploy:
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: 144.24.72.143
          username: ubuntu
          key: ${{ secrets.OCI_SSH_PRIVATE_KEY }}
          script: |
            cd ~/flowspace-v2
            git pull origin main
            docker compose -f docker-compose.prod.yml up --build -d
```

**설계 결정**:
- `paths` 필터로 관련 파일 변경 시에만 배포 트리거
- SSH 키 인증 (`OCI_SSH_PRIVATE_KEY` GitHub Secret)
- OCI에서 직접 `git pull` + 재빌드 방식 (이미지 레지스트리 불사용)

### server/index.ts — CORS 다중 origin 지원

```typescript
const CORS_ORIGINS = (process.env.CORS_ORIGINS || process.env.AUTH_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,  // string → string[]
    methods: ["GET", "POST"],
    credentials: true,
  },
});
```

**변경 전**: `origin: process.env.AUTH_URL || "http://localhost:3000"` (단일 문자열)

**변경 후**: `CORS_ORIGINS` 환경변수에 쉼표 구분 복수 origin 지원.
예: `CORS_ORIGINS=https://flowspace-v2.vercel.app,https://flowspace.flow-coder.com`

### socket-client.ts — NEXT_PUBLIC_SOCKET_URL 지원

```typescript
function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  // 프로덕션: 별도 서브도메인 (e.g. https://v2-socket.flow-coder.com)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  // 개발: 같은 호스트의 다른 포트
  const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001";
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}
```

**변경 전**: `NEXT_PUBLIC_SOCKET_PORT` 기반 동일 호스트 연결만 지원

**변경 후**: `NEXT_PUBLIC_SOCKET_URL` 환경변수로 완전한 URL 오버라이드 가능.
Vercel 환경변수에 `NEXT_PUBLIC_SOCKET_URL=https://v2-socket.flow-coder.com` 설정으로 동작.

### .env.example 추가 항목

```bash
# 프로덕션: 별도 서브도메인 사용 시 (NEXT_PUBLIC_SOCKET_PORT 대신)
# NEXT_PUBLIC_SOCKET_URL=https://v2-socket.flow-coder.com
```

## 배포 현황 (2026-03-06 기준)

| 컴포넌트 | 위치 | 상태 |
|---------|------|------|
| Socket.io v2 | OCI 144.24.72.143:3002 | 정상 실행 |
| Caddy vhost | v2-socket.flow-coder.com | 추가 완료 |
| LiveKit webhook | v2 URL 추가 | 완료 |
| Vercel | flowspace-v2.vercel.app | 배포 완료 |
| 커스텀 도메인 | 미정 | v2 확정 시 연결 예정 |

## 비고
- OCI 서버에는 `.env` 파일을 수동 배치해야 함 (Secrets 미사용)
- `chat-constants.ts` 복사 누락 시 빌드 실패 — `87384c3` 커밋에서 수정
- Socket.io 포트: 로컬 기본 3001, OCI 프로덕션 3002 (포트 충돌 방지)
