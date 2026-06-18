# 06. 결함 분류 (P0~P3)

codex·evaluator 양쪽이 동일 기준으로 분류. `schemas/review.schema.json`의 `severity` enum.

## 등급
| 등급 | 정의 | 예 (FlowSpace 실측) |
|------|------|---------------------|
| **P0** | 인증/인가 우회, 데이터 무결성/기밀 침해, 빌드 불가 | socket `join:space` 무인가, members PATCH cross-space IDOR |
| **P1** | 보안·기능 결함, 라우팅/권한 경계 오류, 생명주기 누수 | GET `accessSecret` 노출, guest PASSWORD 우회, middleware no-op, AUTH_SECRET fail-open, Phaser shutdown 리스너 누수 |
| **P2** | UX/접근성/모바일 회귀, 비치명 리소스 누수, 경계 위반 | asset unlink `../` 격리 없음, `useScreenRecorder` cleanup 누락, 모듈 internal import 위반 |
| **P3** | 정리/문서/테스트 부채 | dead code, 미사용 export, 테스트 커버리지 |

## 게이트 결합 (`01`, `03`)
- **P0/P1** → MUST-FIX. `.pass` 생성 차단. (`fixNow:true`)
- **P2** → 기본 MUST-FIX, 검증자가 `defer:true` + `deferRationale` 명시 시 DEFER 가능 → KI 등록.
- **P3** → 기본 DEFER → KI 등록. 검증자가 `fixNow:true` 명시 시 MUST-FIX.

## issue 필드 (스키마)
`severity` · `location`("파일:라인") · `description`(공격 시나리오/증거, 추측은 "SUSPECTED:") · `recommendation` · `defer` · `deferRationale`(defer=true면 사유, 아니면 null) · `fixNow`.

## verdict 매핑
- `FAIL` — P0 또는 P1 존재
- `WARNING` — P2/P3만 존재
- `PASS` — issue 없음
