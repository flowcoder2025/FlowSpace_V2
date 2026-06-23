# 승격 협의 (consult) — develop→main 승격 GO 판정

너는 FlowSpace(Next.js 15 메타버스, Vercel 웹 + OCI 소켓) 코드를 read-only로 보는 릴리스 검토자다.
산문으로 답하라. 마지막에 "내가(요청자가) 놓칠 위험 1가지"를 반드시 포함하라.

## 상황
- 사용자가 develop→main 승격을 승인했다(프로덕션 라이브 반영).
- 승격 델타 = **WI-029/030/031/032 (4건)**. develop `77e690a` ⊋ main `ba3a82f`(직전 승격 PR#29 = WI-017~024).
  - WI-029-fix: 어드민 대시보드 품질 마감(Logs/Messages 에러처리·Members 로딩/검색/필터)
  - WI-030-feat: 대시보드 고급 필터(메시지/로그 날짜·타입, 공용 query-filter)
  - WI-031-feat: 대시보드 CSV 내보내기(멤버/로그/analytics, 순수 csv.ts)
  - WI-032-fix: 어드민 로그 payload 응답 allowlist + lean DTO
- 4건 전부 develop에서 **듀얼 블라인드 검증 통과**(codex PASS·evaluator 9.85, 각 .pass 산출). 기계게이트 develop HEAD green(tsc0/lint0err/vitest384/build0).

## 배포 영향 실측 (확정)
- `git diff main..develop --name-only`: 변경은 전부 `src/`(dashboard 컴포넌트·admin API 라우트·lib) + `.flowset/`(산출물) + `vitest.config.ts`.
- **server/ 무변경 → OCI 소켓 재배포 불필요**(소켓 코드 동일).
- **prisma/ 무변경 → prod DB 마이그레이션 no-op**.
- 배포설정(Dockerfile/deploy-*.yml/compose)·의존성(package.json/lock) 무변경.
- 즉 승격 = **Vercel 웹 배포만**(자동).

## 승격 방식(직전 선례 PR#18/PR#29)
- **rebase 머지 필수**: gh 인증계정=yonghyeon-dev ≠ Vercel 인가계정=flowcoder25. 일반 merge면 merge commit author=gh계정→Vercel team-members 인가 실패. rebase면 main HEAD가 비-merge 커밋(flowcoder25 작성)이라 author 보존→Vercel 통과.
- 머지 후 main↔develop는 rebase로 SHA 분기 → develop back-sync(force-push) 필요.

## 질문
1. 이 승격을 **GO** 할 수 있는가? 승격 차단(blocker) 결함이 있는가? (4건이 dashboard/API에 집중돼 cross-WI 상호작용 — WI-029/030/031/032가 공유 파일[csv-export·query-filter·pagination·event-log-table·logs route]을 순차 변경했는데 통합 시 정합한가?)
2. Vercel-web-only 승격(OCI/DB no-op) 판단이 맞는가? 내가 놓친 배포 영향(env 신규 요구·런타임 차이)이 있는가?
3. rebase 머지 방식이 맞는가?
4. 내가 놓칠 위험 1가지.

기계게이트·듀얼검증은 통과 가정. 통합/배포/릴리스 관점에 집중.
