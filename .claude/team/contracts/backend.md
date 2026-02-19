# Backend Contract

- **Owner**: Backend Agent
- **Version**: 1.0.0
- **Last Updated**: 2026-02-19

## Scope

### In
- Next.js API 라우트
- Prisma ORM + PostgreSQL
- 인증/인가 (NextAuth 5)
- 파일 저장소 관리
- 환경변수 관리
- 서드파티 API 통합

### Out
- UI 렌더링 (Frontend)
- 게임 로직 (Game Engine)
- Socket 서버 (Communication)
- ComfyUI 직접 통신 (Asset Pipeline)

## Entities
| Entity | Owner | Description |
|--------|-------|-------------|
| User | Backend | 사용자 계정 |
| Account | Backend | OAuth 연동 |
| Session | Backend | 세션 관리 |
| Space | Backend | 가상 공간 |
| Template | Backend | 맵 템플릿 |
| SpaceMember | Backend | 공간 멤버십 |
| GuestSession | Backend | 게스트 세션 |
| ChatMessage | Backend | 채팅 메시지 |
| MapObject | Backend | 맵 오브젝트 |
| PartyZone | Backend | 파티존 |
| GeneratedAsset | Backend | AI 생성 에셋 |
| AssetWorkflow | Backend | 워크플로우 템플릿 |
| SpaceEventLog | Backend | 이벤트 로그 |

## API Surface

### Asset Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/assets/generate` | 에셋 생성 작업 시작 | Yes |
| GET | `/api/assets/[id]` | 에셋 상세 + 상태 | Yes |
| GET | `/api/assets` | 에셋 목록 (필터) | Yes |
| DELETE | `/api/assets/[id]` | 에셋 삭제 | Yes |
| GET | `/api/workflows` | 워크플로우 목록 | Yes |

### Space Endpoints (계획)
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/spaces` | 공간 생성 | Yes |
| GET | `/api/spaces/[id]` | 공간 상세 | Yes |
| GET | `/api/spaces` | 공간 목록 | Yes |

### Events Published
없음 (REST API 패턴)

### Events Consumed
없음 (REST API 패턴)

## Data Ownership
| Table | Backend | Game Engine | Asset Pipeline | Communication | Frontend |
|-------|---------|-------------|----------------|---------------|----------|
| User | RW | None | None | R (via API) | R (via API) |
| Space | RW | None | None | R (via API) | R (via API) |
| GeneratedAsset | RW | R (via API) | R (via API) | None | R (via API) |
| AssetWorkflow | RW | None | R (via API) | None | R (via API) |
| ChatMessage | RW | None | None | W (via API) | R (via API) |
| MapObject | RW | R (via API) | None | None | R (via API) |

## Invariants
1. 모든 API 엔드포인트에 입력 유효성 검증
2. 타 도메인 직접 DB 쓰기 금지
3. Prisma 쿼리 시 select/include 명시
4. 에러 응답: `{ error: string, details?: unknown }`
5. 환경변수 `.env.example`에 문서화
6. 인증 필요 엔드포인트에 세션 체크

## Test Plan
- API 엔드포인트 통합 테스트
- Prisma 쿼리 테스트
- 인증/인가 테스트
- 에러 핸들링 테스트

## Dependencies

### Upstream
| Domain | What | How |
|--------|------|-----|
| 없음 | - | - |

### Downstream
| Domain | What | How |
|--------|------|-----|
| Frontend | API 엔드포인트 | REST API |
| Asset Pipeline | 에셋 CRUD API | REST API |
| Communication | 인증 검증 API | REST API |
| Game Engine | 에셋 메타데이터 API | REST API |

## Breaking Changes
- v1.0.0: 초기 버전

## Consumer Impact
- API 스키마 변경 시: Frontend, Asset Pipeline 영향
- DB 스키마 변경 시: 마이그레이션 필요
