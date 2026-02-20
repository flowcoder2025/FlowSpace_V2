---
paths:
  - "prisma/**"
  - "src/app/api/**"
  - "src/features/**"
---

# Data Ownership Rules

## Core Rule

> **타 도메인은 직접 DB에 쓰기(Write) 불가. 반드시 소유 도메인의 API를 통해 접근.**

## Ownership Matrix

| Table | Owner | 직접 RW | API Read | API Write |
|-------|-------|---------|----------|-----------|
| User | Backend | Backend | All | Backend only |
| Account/Session | Backend | Backend | Backend | Backend only |
| Space/Template | Backend | Backend | All | Backend only |
| SpaceMember | Backend | Backend | All | Backend only |
| GuestSession | Backend | Backend | Communication | Backend only |
| ChatMessage | Backend | Backend | Frontend | Communication (via API) |
| MapObject | Backend | Backend | Game Engine, Frontend | Backend only |
| PartyZone | Backend | Backend | Communication | Backend only |
| GeneratedAsset/AssetWorkflow | Backend | Backend | All | Backend only |
| SpaceEventLog | Backend | Backend | Backend | Backend only |

## Access Patterns

- **Game Engine**: AssetRegistry/MapObject → Backend API GET (DB 직접 접근 금지)
- **Asset Pipeline**: GeneratedAsset 생성 → Backend API POST (DB 직접 접근 금지)
- **Communication**: ChatMessage 저장 → Backend API POST (DB 직접 접근 금지)
- **Frontend**: 모든 데이터 → Backend API 통해 접근 (DB 직접 접근 금지)

## Violation Detection

- Prisma import가 허용 경로(`src/app/api/`, `src/lib/`, `prisma/`) 외에 존재 시 위반
