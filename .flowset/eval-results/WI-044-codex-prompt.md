너는 FlowSpace(Next.js 15) 독립 블라인드 코드 검증자(codex)다. ACTIVE WI 구현을 read-only로 적대 검증하고 출력 스키마 JSON 하나만 최종 메시지로 내라(verdict PASS|WARNING|FAIL, issues P0~P3).

## WI-044-fix 범위 (impl 9300b83, develop 분기)
**증상(사용자 라이브 보고+스크린샷)**: 인-스페이스 참가자 카드 ⋮ 메뉴에서 맨 아래 "내보내기(kick)/차단(ban)"과 에러 메시지가 안 보임. 보이는 "채팅 음소거/음성 강제 음소거"도 "동작 안 함"처럼 느껴짐.
**원인(코드 확정)**: `src/components/space/video/VideoTile.tsx`(루트 `relative ... overflow-hidden`, 둥근 모서리용) 안에 `MemberActionsMenu` 드롭다운이 `absolute`로 떠서, 타일 높이(aspect-video, 작음)를 넘는 하위 항목이 `overflow-hidden`에 잘림. 메뉴 순서: 채팅음소거→[음성강제음소거/발언허용]→내보내기→차단→에러. 아래쪽이 잘림. 에러도 드롭다운 하단이라 잘려 액션 실패가 무반응으로 보임.

**해소**: `src/components/space/member-actions-menu.tsx` — 드롭다운을 React `createPortal(document.body)`로 렌더(overflow 탈출). 위치=버튼 `getBoundingClientRect()` 기준 `position:fixed` 좌표를 `useLayoutEffect`에서 계산(resize + scroll[capture] 추종), 아래 공간<200px이고 위가 더 넓으면 위로 플립(bottom 앵커), `maxHeight`=가용공간 + `overflow-y-auto`. 가로는 align(left/right)별 버튼 모서리 정렬 + 뷰포트 clamp. 외부클릭 닫기는 buttonRef+dropdownRef 둘 다 체크(portal이 buttonRef 밖이라). 메뉴 내용/게이팅/액션 로직은 무변경.

**변경 파일(2)**: member-actions-menu.tsx(portal 재작성) + member-actions-menu.test.tsx(+2: 하위 항목 전수 존재·드롭다운 document.body 직속 portal 단언).

## 적대 검증 관점
- **SSR 안전성**: `createPortal(_, document.body)`가 서버 렌더에서 `document` 미정의로 크래시하나? (open 초기 false라 단락되는지)
- **포지셔닝 정확성**: openUp/clamp/maxHeight 계산 경계(아래공간 음수·버튼 화면밖·작은 뷰포트). 플립 시 bottom 앵커 정확?
- **리스너 누수**: resize/scroll(capture) 리스너가 close/unmount 시 정확히 제거되나?
- **외부클릭**: portal 드롭다운 내부 클릭이 닫힘을 유발하지 않나(dropdownRef 체크)? 메뉴 항목 클릭 정상?
- **회귀**: 기존 게이팅(member/actorRole/canActOn/self)·PATCH(memberId만)·음성 액션·확인 플로우 무변경인가? align 기본 right 보존?
- **무한루프**: useLayoutEffect 의존성([open, align])이 setCoords로 재실행 루프 유발하나?
- **범위**: server/·prisma/ 무관(Vercel 전용) 맞나?

## 기계 게이트(권위 환경)
tsc0 / eslint 0 errors(선재 LiveKit 경고1·WI무관) / vitest 561→563(+2) 전부 통과 / next build exit0. 샌드박스 read-only면 vitest spawn EPERM은 환경제약(P3)이지 결함 아님 — tsc/lint/인스펙션으로 판정.
