# Phase 2: Customization UI

> Epic: [파츠 조합 캐릭터 시스템](./README.md)
> 상태: ✅ 완료 | 업데이트: 2026-02-21

## 목표
캐릭터 에디터 React 컴포넌트 + 온보딩/API 통합

## Task 목록
- [x] Task 2.1: 카테고리 탭 + 파츠 그리드
- [x] Task 2.2: 색상/피부색 선택기 + 프리뷰 캔버스
- [x] Task 2.3: 온보딩 폼 교체 (색상 선택기 → CharacterEditor)
- [x] Task 2.4: API 검증 + space 페이지 아바타 전달

## 구현 상세

### Task 2.1-2.2: 에디터 컴포넌트
**파일:** `src/components/avatar/` (7 파일)
- `character-editor.tsx` — 메인 에디터 (카테고리 + 그리드 + 프리뷰)
- `category-tabs.tsx` — 6개 카테고리 탭
- `part-grid.tsx` — 파츠 썸네일 그리드
- `color-picker.tsx` — 프리셋 + 커스텀 HEX 색상
- `skin-tone-picker.tsx` — 피부색 팔레트
- `preview-canvas.tsx` — 워킹 애니메이션 미리보기 (Phaser 불필요)

### Task 2.3: 온보딩 교체
**파일:** `src/components/auth/onboarding-form.tsx`
- 기존 색상 선택기 제거 → `CharacterEditor` 컴포넌트 교체
- DB 저장: `avatarConfig: { avatarString: "parts:..." }`

### Task 2.4: API + Space 페이지
**파일:** `src/app/api/users/me/route.ts`, `src/app/space/[id]/page.tsx`
- `validateAvatarConfig()` — avatarString 포맷 검증
- space 페이지: `user.avatarConfig.avatarString` 추출 → 게임에 전달

## 변경된 파일
| 파일 | 유형 | 설명 |
|------|------|------|
| `src/components/avatar/*.tsx` | 추가 | 에디터 컴포넌트 7파일 |
| `src/components/auth/onboarding-form.tsx` | 수정 | CharacterEditor 교체 |
| `src/app/api/users/me/route.ts` | 수정 | avatarConfig 검증 |
| `src/app/space/[id]/page.tsx` | 수정 | avatarString 추출 |
