# Data Ownership Rules

## Core Rule
> **타 도메인은 직접 DB에 쓰기(Write) 불가. 반드시 소유 도메인의 API를 통해 접근.**

## Ownership Matrix

| Table | Owner | 직접 RW | API Read | API Write |
|-------|-------|---------|----------|-----------|
| User | Backend | Backend | All | Backend only |
| Account | Backend | Backend | Backend | Backend only |
| Session | Backend | Backend | Backend | Backend only |
| Space | Backend | Backend | All | Backend only |
| Template | Backend | Backend | All | Backend only |
| SpaceMember | Backend | Backend | All | Backend only |
| GuestSession | Backend | Backend | Communication | Backend only |
| ChatMessage | Backend | Backend | Frontend | Communication (via API) |
| MapObject | Backend | Backend | Game Engine, Frontend | Backend only |
| PartyZone | Backend | Backend | Communication | Backend only |
| GeneratedAsset | Backend | Backend | All | Backend only |
| AssetWorkflow | Backend | Backend | All | Backend only |
| SpaceEventLog | Backend | Backend | Backend | Backend only |

## Access Patterns

### Game Engine
- AssetRegistry 메타데이터: Backend API GET 호출
- MapObject 목록: Backend API GET 호출
- **DB 직접 접근 금지**

### Asset Pipeline
- GeneratedAsset 생성: Backend API POST 호출
- AssetWorkflow 조회: Backend API GET 호출
- **DB 직접 접근 금지**

### Communication
- 인증 토큰 검증: Backend API 호출
- ChatMessage 저장: Backend API POST 호출
- **DB 직접 접근 금지**

### Frontend
- 모든 데이터: Backend API 통해 접근
- **DB 직접 접근 금지**

## Violation Detection
- Prisma import가 Backend 소유 경로 외에 존재 시 위반
- 검증 스크립트: `grep -r "from.*prisma" src/ --include="*.ts" | grep -v "src/app/api/" | grep -v "src/lib/"`
