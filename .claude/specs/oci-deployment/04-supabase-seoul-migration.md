# Phase 4: Supabase 시드니 → 서울 마이그레이션

> 상태: 완료 | 완료일: 2026-05-06

## 목표
v2 Supabase 프로젝트를 시드니(`ap-southeast-2`) → 서울(`ap-northeast-2`)로 이전하여 한국 사용자 latency 개선.

## 배경
- Supabase는 프로젝트 생성 후 리전 변경 불가 → 신규 프로젝트 + 데이터 마이그레이션 필수
- 시드니 리전은 한국에서 ~150ms 추가 latency 발생
- v1 (서울)과 v2 (시드니) 분리 운영 중이었으나 v1은 폐기 결정 → v2도 서울로 통일

## 결과
| 항목 | 값 |
|------|---|
| 신규 프로젝트 | `FlowSpace2` (id: `fqhcnudechuchaazwrzg`) |
| 리전 | `ap-northeast-2` (서울) |
| 비용 | $0/월 (Free tier) |
| 마이그레이션 데이터 | 144 rows (~1MB) |
| 다운타임 | Vercel 재배포 ~2분 + OCI 재시작 ~1분 |
| Latency 개선 | 사용자 체감 "데이터 로딩 속도 확실히 빨라짐" |

## 마이그레이션 절차

### 1. 신규 프로젝트 생성
사용자가 Supabase 대시보드에서 직접 생성 (`mcp__supabase__create_project` 가용했으나 비밀번호 입력 보안상 사용자 직접 진행). 동일 organization (`mhceoljqkcyehqfwkigi`), 동일 비밀번호.

### 2. Prisma 스키마 적용
```bash
# .env를 새 DB로 임시 swap
npx prisma migrate deploy  # 0_init 적용
npx prisma db push --skip-generate  # 스키마 드리프트 캡처
```

**중요**: `0_init` 마이그레이션만으로는 스키마 불완전. 운영 중 직접 ALTER로 추가된 컬럼들이 마이그레이션 파일에 누락됨:
- `GeneratedAsset.isShared`
- `MapObject.objectType`, `width`, `height`, `isActive`, `label`

→ `prisma db push`로 schema.prisma SSOT 기준 동기화 필수.

### 3. 데이터 마이그레이션
재사용 가능 스크립트: [`scripts/migrate-supabase-data.py`](../../../scripts/migrate-supabase-data.py)

```python
# psycopg3 + Json 어댑터 + SET session_replication_role='replica'로 FK 우회
# 의존성 순서대로 INSERT, ON CONFLICT DO NOTHING
```

**테이블별 결과** (모두 source = target 일치):
| 테이블 | rows |
|--------|------|
| ChatMessage | 98 |
| GeneratedAsset | 17 |
| SpaceMember | 9 |
| User | 8 |
| Space | 4 |
| AssetWorkflow | 3 |
| Template | 3 |
| Account | 1 |
| _prisma_migrations | 1 |
| (빈 테이블 7개) | 0 |

### 4. _prisma_migrations 중복 정리
`migrate deploy` + 데이터 마이그레이션 중첩으로 같은 `0_init` 행이 2개 생김. 신규(2026-05-06) 행 삭제, 원본 시드니 행(2026-02-20) 보존.

### 5. Vercel 프로덕션 env 갱신
```bash
vercel env rm DATABASE_URL production --yes
vercel env rm DIRECT_URL production --yes
echo "$NEW_DB_URL" | vercel env add DATABASE_URL production
echo "$NEW_DIRECT_URL" | vercel env add DIRECT_URL production
vercel redeploy <prev-prod-url> --target production
```

### 6. OCI v2 socket .env 갱신
```bash
# 백업 후 perl in-place 치환 (특수문자 안전)
ssh ubuntu@OCI 'perl -i -pe "s|^DATABASE_URL=.*|DATABASE_URL=...|" .env'
docker-compose -f docker-compose.prod.yml restart
```

## 검증
- ✅ Seoul DB row count = Sydney DB row count (모든 테이블)
- ✅ Vercel 프로덕션 배포 Ready (`flowspace-v2-n3oju83p4`)
- ✅ OCI socket 재시작 후 멤버 로드 정상 (`[Room] 조용현 joined`)
- ✅ 사용자 체감 latency 개선 확인

## 보존 자산 (롤백 대비)
| 위치 | 용도 | 보존 기간 |
|------|------|----------|
| 로컬 `.env.backup-pre-seoul` | 시드니 연결정보 | 1주 |
| OCI `/home/ubuntu/flowspace-v2/.env.backup-pre-seoul` | 시드니 연결정보 | 1주 |
| Sydney Supabase 프로젝트 (`afdfkpxsfuyccdvrkqwu`) | 데이터 + 스키마 | ACTIVE 유지 → 검증 후 일시정지 → 1주 후 삭제 |

## 핵심 교훈
1. **Supabase 리전 변경 불가** — 신규 프로젝트 + 마이그레이션이 유일 경로
2. **Prisma 스키마 드리프트 검증 필수** — 마이그레이션 파일 ≠ 실제 DB 상태일 수 있음. `db push`로 SSOT 동기화
3. **psycopg3 + Json 어댑터** — JSONB 컬럼은 dict/list를 자동 변환 안 함, `Json()` 래핑 필수
4. **session_replication_role = 'replica'** — FK 의존성 순서 무시하고 일괄 INSERT 가능
5. **`_prisma_migrations` 중복 주의** — `migrate deploy` 후 데이터 마이그레이션은 같은 행을 또 INSERT. 한 쪽만 남기기
6. **다중 환경 갱신**: Vercel + OCI + 로컬 .env 3곳 동시 갱신해야 일관성 유지
