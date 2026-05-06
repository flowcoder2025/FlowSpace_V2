# FlowSpace Specs Index

## Drift Tracking
- Last Reviewed Commit: `a5a4e76`
- Last Review Date: 2026-05-07

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

## Ad-hoc Work (2026-05-07)
- **Chrome 146 화면공유 picker 검정 박스** (KNOWN ISSUE, 수용): WebGL canvas + self-capture 재귀에서 picker preview가 검정 fallback. 본인만 잠깐 보이는 시각적 잔재 (공유 영상/타 참가자 영향 없음). 폐기 가설(Scale, backgroundColor, backdrop-filter, preserveDrawingBuffer 모두 무관) + 폐기 해결책(Phaser.CANVAS=타일 줄무늬, display:none=Framebuffer 크래시) 기록. 미검증 가설(antialias:false, selfBrowserSurface) 추후 가능. test-screenshare 진단 페이지 제거 완료. (`livekit-voicevideo/14-chrome146-screenshare-picker.md`)

## Ad-hoc Work (2026-05-06)
- 랜딩페이지 신규 구현: `/` 라우트 → 9개 섹션 랜딩. 모노크롬 디자인 시스템(cream/ink/line 토큰, Source Serif 4 + Pretendard) 최초 확정. ImageSlot 패턴으로 스크린샷 슬롯 6개 와이어프레임 유지 중. (`landing/2026-05-06-initial-implementation.md`) **→ 이후 전체 앱으로 토큰 확산 (아래 항목 참조)**
- **디자인 시스템 전면 롤아웃**: 랜딩 토큰(cream/ink/line/brand)을 전체 앱으로 확장. 스크립트 일괄 치환 47파일(Navbar/인증/온보딩/스페이스/운영자 대시보드/인게임 UI) + 수동 보강 8파일. Phaser Scale.FIT → Scale.RESIZE (letterbox 제거, 게임 월드 좌표 영향 없음). 인게임 UI 다크 글래스모피즘(bg-ink/80~95 + backdrop-blur-md) 통일. chat/* 및 시맨틱 컬러 의도적 미적용. **→ 페이지 단위 재작업 완료 (commit 8bdbb29)**: bulk regex 한계(컬러만, 구조 미변경) 확인 후 10파일 재작업. 글로벌 Navbar 전면 재작성(Logo.png + font-serif + sticky blur), my-spaces 탭/SpaceCard 재설계, login/onboarding 헤드라인 통일, 폼 uppercase 라벨 + ring-ink/10 확정. 페이지 헤더/카드/탭/입력/SpaceCard 패턴 앱 기준 확정. tsc + build 통과. (`landing/2026-05-06-design-system-rollout.md`)
- 인증 단순화 (GitHub OAuth 제거): GitHub provider 코드/UI 제거 → Google OAuth + Credentials 2체제 정착. Google Cloud Console OAuth Client 신규 발급, Vercel 프로덕션 env 등록 완료. 동의 화면은 테스트 모드 유지 (vercel.app = PSL 도메인, 커스텀 도메인 연결 후 Production 전환 필요) (`auth/2026-05-06-github-removal.md`)
- Supabase 서울 마이그레이션: 시드니→서울 신규 프로젝트 + 데이터 144 rows 이전 + Prisma 스키마 드리프트 동기화. 사용자 체감 latency 개선 확인 (`oci-deployment/04-supabase-seoul-migration.md`)
- OCI v1 스택 제거: flowspace-socket 컨테이너/이미지/Caddy 라우트 제거, LiveKit/Caddy 공유 인프라는 유지, v1 소스 1주 보존 (`oci-deployment/05-v1-removal.md`)
- 시드니 Supabase 영구 삭제: 사용자가 대시보드에서 직접 삭제 완료 (2026-05-07)
- Assets 메뉴/페이지 제거: `/assets` 라우트 + `src/components/assets/` 삭제, `navigation.ts` ROUTES.ASSETS + NAV_ITEMS 제거, 홈 Dashboard Assets 카드 제거. API(`src/app/api/assets/**`) + 비즈니스 로직(`src/features/assets/**`)은 게임/에디터 의존성으로 유지. 네비바 미표시, `/assets` 직접 접근 시 404.
- **Navbar 단일화** (commit 13ab311): LandingNavbar 삭제, 글로벌 Navbar 단일 컴포넌트 통합. 마케팅 메뉴(기능/사용법/사례/가격) 로그인 여부 무관 노출, 로그인 시 "공간" 메뉴 추가. 버튼: outline(로그인/로그아웃) vs fill(시작하기/새 스페이스). 모바일 햄버거 md 미만 풀 패널. NavbarWrapper `/` 숨김 로직 제거. (`landing/2026-05-06-design-system-rollout.md` — "Navbar 단일화" 섹션)

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
├── landing/
│   ├── 2026-05-06-initial-implementation.md
│   └── 2026-05-06-design-system-rollout.md
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
│   ├── 12-membership-bugfix.md
│   └── 14-chrome146-screenshare-picker.md  ← 진단 진행중 (antialias 미검증)
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
