# Ad-hoc: Vercel 서울 리전 전환

> Epic: [oci-deployment](./README.md)
> 상태: 완료 | 완료일: 2026-04-19
> 커밋: `091c524`, `b0b4f1e`

## 개요
Vercel 배포를 서울 리전(`icn1`)으로 전환. 프로젝트를 개인 Hobby 계정에서
flowcoder Pro 팀으로 이관하고, 리전 설정 및 `serverlessFunctionRegion`을 적용.

## 변경 파일
| 파일 | 변경 유형 |
|------|-----------|
| `vercel.json` | 수정 — `regions: ["icn1"]` 추가 |

## 주요 구현

### vercel.json

```json
{
  "regions": ["icn1"]
}
```

`icn1` = Incheon (Seoul) 리전. Vercel Pro 플랜에서 지원.

### Vercel 프로젝트 팀 이관 절차

Vercel REST API 2단계 프로세스 (UI에서 직접 이관 불가, API 필수):

```bash
# Step 1: 이관 요청 생성 (Owner 권한 필요)
curl -X POST "https://api.vercel.com/v1/projects/{projectId}/transfer-request" \
  -H "Authorization: Bearer {token}" \
  -d '{"teamId": "{targetTeamId}"}'

# Step 2: 이관 수락
curl -X POST "https://api.vercel.com/v1/projects/{projectId}/transfer-request/{transferId}" \
  -H "Authorization: Bearer {token}"
```

- `projectId`, `teamId`: Vercel 대시보드 → Project Settings에서 확인
- 이관 완료 후 프로젝트 설정 > General > `serverlessFunctionRegion: icn1` 적용

### 프로젝트 이관 전후

| 항목 | 이전 | 이후 |
|------|------|------|
| 팀 | yh-devs-projects (Hobby) | flowcoder (Pro) |
| 리전 | 자동 (us-east) | icn1 (Seoul) |
| URL | `flowspace-v2.vercel.app` | 동일 (유지) |
| serverlessFunctionRegion | 미설정 | icn1 |

## 비고
- Hobby 플랜은 `regions` 설정이 무시됨 — Pro 플랜으로 이관 필수
- URL `flowspace-v2.vercel.app`은 팀 이관 후에도 유지됨 (도메인 재연결 불필요)
- `b0b4f1e` 커밋은 vercel.json 변경 없이 배포 재트리거 목적으로 생성됨 (빈 커밋)
