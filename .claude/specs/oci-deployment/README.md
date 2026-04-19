# Epic: OCI Deployment

> 상태: 완료 | 완료일: 2026-03-06

## 목표
FlowSpace v2 Socket.io 서버를 OCI(Oracle Cloud Infrastructure) 인스턴스에 배포.
Next.js(Vercel) + Socket.io(OCI) + DB(Supabase) 분리 아키텍처로 전환.

## 완료된 Phase
| Phase | 제목 | 상태 |
|-------|------|------|
| [Phase 1](./01-socket-infra.md) | Socket.io 프로덕션 인프라 | 완료 |
| [Phase 2](./02-prisma-runtime-singleton.md) | Prisma 런타임 Docker 통합 + 싱글턴 | 완료 |
| [Phase 3](./03-vercel-seoul-region.md) | Vercel 서울 리전 전환 | 완료 |

## 최종 아키텍처
```
클라이언트 (브라우저)
  ├── Next.js App: https://flowspace-v2.vercel.app (Vercel Pro, icn1 Seoul)
  └── Socket.io:   https://socket-v2.144.24.72.143.nip.io → OCI :3002
                   (Caddy reverse proxy)
DB: Supabase (PgBouncer)
LiveKit: v1 서버 공유 (v2 webhook URL 추가)
```

## OCI 서버
- IP: 144.24.72.143
- 경로: `~/flowspace-v2`
- 배포 방식: GitHub Actions → SSH → `docker compose -f docker-compose.prod.yml up --build -d`
