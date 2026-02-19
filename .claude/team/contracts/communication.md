# Communication Contract

- **Owner**: Communication Agent
- **Version**: 1.0.0
- **Last Updated**: 2026-02-19

## Scope

### In
- Socket.io 서버 (Node.js standalone)
- 클라이언트 소켓 연결 관리
- 실시간 플레이어 위치 동기화
- 채팅 메시지 중계 (그룹/귓속말/파티)
- 파티존 기반 그룹핑
- 연결 상태 관리

### Out
- WebRTC 미디어 (제외 - 추후 검토)
- UI 렌더링 (Frontend)
- 게임 렌더링 (Game Engine)
- DB 저장 (Backend)

## Entities
- 없음 (DB 직접 접근 없음)

## API Surface

### Socket Events (Server → Client)
| Event | Payload | Description |
|-------|---------|-------------|
| `player:joined` | `{ userId, nickname, avatar, position }` | 새 플레이어 입장 |
| `player:left` | `{ userId }` | 플레이어 퇴장 |
| `player:moved` | `{ userId, x, y, direction }` | 플레이어 이동 |
| `chat:message` | `{ userId, content, type, timestamp }` | 채팅 메시지 |
| `party:updated` | `{ zoneId, members }` | 파티존 멤버 변경 |

### Socket Events (Client → Server)
| Event | Payload | Description |
|-------|---------|-------------|
| `join:space` | `{ spaceId, userId, avatar }` | 공간 입장 |
| `leave:space` | `{ spaceId }` | 공간 퇴장 |
| `move` | `{ x, y, direction }` | 위치 업데이트 |
| `chat:send` | `{ content, type, targetId? }` | 채팅 전송 |
| `party:join` | `{ zoneId }` | 파티존 참가 |
| `party:leave` | `{ zoneId }` | 파티존 퇴장 |

## Data Ownership
| Table | Access |
|-------|--------|
| 없음 | DB 직접 접근 없음 |

## Invariants
1. 위치 업데이트 throttle: 100ms 간격
2. 재연결: exponential backoff (1s, 2s, 4s, 8s, max 30s)
3. 비인증 연결 거부
4. 모든 메시지 sanitize (XSS 방지)
5. 파티존 범위 밖 이동 시 자동 파티 퇴장

## Test Plan
- 연결/재연결 테스트
- 위치 동기화 정확성 테스트
- 채팅 메시지 전달 테스트
- 파티존 입장/퇴장 테스트
- 동시 접속 부하 테스트

## Dependencies

### Upstream
| Domain | What | How |
|--------|------|-----|
| Backend | 인증 토큰 검증 | API 호출 |
| Game Engine | 로컬 플레이어 이벤트 | EventBridge |

### Downstream
| Domain | What | How |
|--------|------|-----|
| Game Engine | 원격 플레이어 이벤트 | EventBridge |
| Frontend | 채팅 메시지 | Socket → UI 업데이트 |

## Breaking Changes
- v1.0.0: 초기 버전

## Consumer Impact
- Socket 이벤트 타입 변경 시: Game Engine, Frontend 영향
- 페이로드 구조 변경 시: 모든 클라이언트 업데이트 필요
