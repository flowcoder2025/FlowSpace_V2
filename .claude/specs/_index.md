# FlowSpace Specs Index

## Drift Tracking
- Last Reviewed Commit: `4c64f50`
- Last Review Date: 2026-05-06

## Active Epics
| Epic | 현재 Phase | 상태 |
|------|-----------|------|
| [chibi-pipeline](./chibi-pipeline/README.md) | Phase 12 (멀티뷰 스프라이트시트) | LiveKit 에러 진단 강화 완료. **다음: LiveKit 연결 테스트 → 충돌 영역 → Y-sorting** |

## Recently Completed
| Epic | 완료일 | 핵심 결과 |
|------|--------|-----------|
| [oci-deployment](./oci-deployment/README.md) Phase 4~5 | 2026-05-06 | Supabase 서울 이전 + v1 OCI 스택 제거 |
| [oci-deployment](./oci-deployment/README.md) Phase 2~3 | 2026-04-19 | Prisma Docker 런타임 + 싱글턴, Vercel 서울 리전 |
| [oci-deployment](./oci-deployment/README.md) Phase 1 | 2026-03-06 | Socket.io OCI 배포, CD 자동화, CORS 다중 origin |
| [chibi-pipeline](./chibi-pipeline/README.md) Phase 1~11 | 2026-02-23 | batch v2, 77% 속도 향상 |

## Completed Epics
| Epic | 완료일 | Phase 수 |
|------|--------|----------|
| [oci-deployment](./oci-deployment/README.md) | 2026-03-06 | 1 |
| [comfyui-asset-pipeline](./comfyui-asset-pipeline/README.md) | 2026-02-19 | 7 |
| [map-editor](./map-editor/README.md) | 2026-02-19 | 1 (Phase 8) |
| [admin-dashboard](./admin-dashboard/README.md) | 2026-02-19 | 1 (Phase 9) |
| [chat-port](./chat-port/README.md) | 2026-02-20 | 6 (Phase 10) |
| [livekit-voicevideo](./livekit-voicevideo/README.md) | 2026-02-20 | 1 (Phase 11) |
| [parts-avatar-system](./parts-avatar-system/README.md) | 2026-02-21 | 3 (Phase 1~3) |
| [asset-integration](./asset-integration/README.md) | 2026-02-22 | 1 (연동 수정) |

## Ad-hoc Work (2026-05-06)
- 인증 단순화 (GitHub OAuth 제거): GitHub provider 코드/UI 제거 → Google OAuth + Credentials 2체제 정착. Google Cloud Console OAuth Client 신규 발급, Vercel 프로덕션 env 등록 완료. 동의 화면은 테스트 모드 유지 (vercel.app = PSL 도메인, 커스텀 도메인 연결 후 Production 전환 필요) (`auth/2026-05-06-github-removal.md`)
- Supabase 서울 마이그레이션: 시드니→서울 신규 프로젝트 + 데이터 144 rows 이전 + Prisma 스키마 드리프트 동기화. 사용자 체감 latency 개선 확인 (`oci-deployment/04-supabase-seoul-migration.md`)
- OCI v1 스택 제거: flowspace-socket 컨테이너/이미지/Caddy 라우트 제거, LiveKit/Caddy 공유 인프라는 유지, v1 소스 1주 보존 (`oci-deployment/05-v1-removal.md`)
- 시드니 Supabase 일시정지: 미완료 — 사용자 검증 며칠 진행 후 별도 작업으로 처리 예정 [PENDING]

## Ad-hoc Work (2026-04-19)
- LiveKit 멤버십 자동 생성: PUBLIC 스페이스 직접 입장 시 spaceMember 자동 생성 → LiveKit "not a member" 에러 수정 (`livekit-voicevideo/12-membership-bugfix.md`)
- Vercel 서울 리전 전환: icn1, Hobby→Pro 팀 이관, URL 유지 (`oci-deployment/03-vercel-seoul-region.md`)
- Socket Docker Prisma 런타임: esbuild external + dynamic import + 싱글턴, Alpine binary target 추가 (`oci-deployment/02-prisma-runtime-singleton.md`)
- CD 워크플로우 미동작: `OCI_SSH_PRIVATE_KEY` GitHub Secret 미설정 — 수동 배포 중 [KNOWN ISSUE]

## Ad-hoc Work (2026-03-09)
- LiveKit 연결 에러 진단 강화: connectionError UI 전파, 토큰 API 타임아웃, 에러 메시지 표시

## Ad-hoc Work (2026-02-22)
- 에셋 갤러리 리팩토링: 스튜디오/생성폼 제거, 단일 갤러리 통합
- 오피스 테마 에셋 배치 생성 (캐릭터 3 + 타일셋 1 + 맵 1)

## Ad-hoc Work (2026-02-21)
- 배포 준비: Dockerfile, docker-compose, CI, Vitest, Prisma migrate
- 실사용 버그 수정: 소켓 인증, Prisma PgBouncer, 채팅 id 충돌, Phaser 키보드

## File Structure
```
specs/
├── _index.md
├── auth/
│   └── 2026-05-06-github-removal.md
├── oci-deployment/
│   ├── README.md
│   ├── 01-socket-infra.md
│   ├── 02-prisma-runtime-singleton.md
│   ├── 03-vercel-seoul-region.md
│   ├── 04-supabase-seoul-migration.md
│   └── 05-v1-removal.md
├── livekit-voicevideo/
│   ├── README.md
│   ├── 11-livekit-integration.md
│   └── 12-membership-bugfix.md
├── comfyui-asset-pipeline/
│   ├── README.md
│   ├── 01~07 phase specs
│   └── decisions/
├── map-editor/
├── admin-dashboard/
├── chat-port/
├── parts-avatar-system/
├── asset-integration/
└── chibi-pipeline/
    ├── README.md
    ├── 01-frame-generation.md
    ├── 08-ipadapter-identity.md
    ├── 10-batch-refactoring.md
    ├── 11-consistency-optimization.md
    ├── 12-3d-to-chibi-pipeline.md  ← Task 12.32 (정적 에셋 전환) 포함
    ├── quality-checklist.md
    └── decisions/
        ├── 2026-02-22-pixelart-to-chibi.md
        ├── 2026-02-22-normalize-strategy.md
        ├── 2026-02-22-ipadapter-identity.md
        ├── 2026-02-22-lora-training.md
        ├── 2026-02-24-character-sheet-approach.md
        ├── 2026-02-24-depth-controlnet-over-openpose.md
        ├── 2026-02-25-ipadapter-style-composition-back.md
        ├── 2026-02-25-warm-ref-approach.md
        ├── 2026-02-25-6char-adoption.md
        ├── 2026-02-25-2pass-abandoned.md
        ├── 2026-02-25-code-based-walking.md
        ├── 2026-02-25-resolution-upgrade-96x128.md
        ├── 2026-02-25-premultiply-alpha-defringe.md
        ├── 2026-02-25-white-outline-root-cause.md
        └── 2026-03-03-hunyuan3d-back-view.md
```
