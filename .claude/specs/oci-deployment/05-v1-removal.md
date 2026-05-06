# Phase 5: OCI v1 스택 제거

> 상태: 완료 | 완료일: 2026-05-06

## 목표
flow_metaverse v1 socket 컨테이너를 OCI에서 제거. 공유 인프라(Caddy, LiveKit)는 유지.

## 배경
- v1 (`/home/ubuntu/flowspace`): flow_metaverse — 폐기 결정
- v2 (`/home/ubuntu/flowspace-v2`): FlowSpace v2 — 유일한 운영 서비스
- v1 docker-compose 안에 socket-server + caddy + livekit 함께 정의되어 있었음
- caddy + livekit은 v2에서도 사용 중 → 부분 제거 필요

## 변경 범위

### 제거 대상
| 항목 | 위치 |
|------|------|
| `flowspace-socket` 컨테이너 | OCI Docker |
| `space-socket.flow-coder.com` Caddy 라우트 | `flowspace/caddy/Caddyfile` |
| `socket.144.24.72.143.nip.io` Caddy 라우트 | `flowspace/caddy/Caddyfile` |
| `socket-server` 서비스 정의 | `flowspace/docker-compose.yml` |
| `caddy.depends_on: socket-server` | `flowspace/docker-compose.yml` |
| 미사용 v1 Docker 이미지 | OCI |

### 유지
| 항목 | 이유 |
|------|------|
| `flowspace-livekit` 컨테이너 | v2에서 사용 (host network, 7880) |
| `flowspace-caddy` 컨테이너 | v2 reverse proxy 담당 |
| `space-livekit.flow-coder.com` | v2 LiveKit 도메인 |
| `v2-socket.flow-coder.com` | v2 socket 도메인 |
| `livekit.144.24.72.143.nip.io` | LiveKit fallback |
| `socket-v2.144.24.72.143.nip.io` | v2 socket fallback |
| `/home/ubuntu/flowspace/server/` 소스 코드 | 1주 롤백 대비 보존 |

## 절차
1. `docker-compose.yml`에서 `socket-server` 서비스 + `depends_on` 제거
2. `Caddyfile`에서 v1 라우트 2개 제거 (brace-aware Python script로 안전 추출)
3. `docker stop flowspace-socket && docker rm flowspace-socket`
4. `docker exec flowspace-caddy caddy reload --config /etc/caddy/Caddyfile`
5. `docker image prune -af` → 1.6GB 회수

## 검증
- ✅ `docker ps`: flowspace-v2_socket_1, flowspace-caddy, flowspace-livekit만 실행
- ✅ Caddy 리로드 로그 정상 (`load complete`)
- ✅ v2 socket HTTP/2 응답 (`v2-socket.flow-coder.com` → 400 socket.io 응답)
- ✅ LiveKit 도메인 응답 (`space-livekit.flow-coder.com` → 200)

## 보존 자산 (롤백 대비)
| 위치 | 용도 |
|------|------|
| `/home/ubuntu/flowspace/docker-compose.yml.pre-v1-removal` | v1 compose 백업 |
| `/home/ubuntu/flowspace/caddy/Caddyfile.pre-v1-removal` | v1 Caddy 백업 |
| `/home/ubuntu/flowspace/server/` | v1 socket 소스 코드 (1주 보존) |

## 핵심 교훈
1. **공유 인프라 부분 제거 시 brace-aware 파싱** — Caddyfile 블록 단위 제거는 단순 regex 불충분, 중첩 `{...}` 카운팅 필요
2. **docker-compose v1 ContainerConfig 버그 우회** — 서비스 제거 후 `up -d`보다 컨테이너 단위 `stop/rm` + Caddy 핫 리로드가 안정적
3. **롤백 자산 보존** — 즉시 삭제하지 말고 1주 보존 후 정리
